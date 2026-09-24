import {
  BACKUP_TABLES,
  type BackupRow,
  type BackupTable,
  type ImportSummary,
} from '@/core/backup/backup';
import {
  REMOTE_TABLES,
  SYNC_ORDER,
  chunk,
  pushableRows,
  toLocalRow,
  toRemoteRow,
  type SyncState,
} from '@/core/sync/sync';
import type { BackupRepository } from '@/repositories';

/** The cloud side, as seen by the sync engine (Supabase in the app, a fake in tests). */
export interface RemoteStore {
  /** Inserts or updates rows (remote shape). The server keeps the newer `updated_at`. */
  upsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  /**
   * Rows ordered by `server_updated_at`, after `since` (or from it when `inclusive`), at most
   * `limit`. `since = null` means from the beginning.
   */
  pull(
    table: string,
    since: string | null,
    inclusive: boolean,
    limit: number,
  ): Promise<Record<string, unknown>[]>;
  /** Deletes every row of the signed-in user. */
  deleteAll(): Promise<void>;
  /** Every key (`id`, or `key` for settings) the signed-in user has in `table`. */
  keys(table: string): Promise<string[]>;
  /** The account already has something of its own in the cloud (settings aside). */
  hasData(): Promise<boolean>;
}

export interface SyncResult {
  state: SyncState;
  pushed: number;
  pulled: number;
  applied: ImportSummary;
}

const PUSH_CHUNK = 200;
const PULL_PAGE = 500;

function rowKey(table: BackupTable, row: Record<string, unknown>): string {
  return String(table === 'settings' ? row.key : row.id);
}

/** Every remote row changed after the table cursor, page by page. */
async function pullTable(
  remote: RemoteStore,
  table: BackupTable,
  cursor: string | null,
  pageSize: number,
): Promise<{ rows: BackupRow[]; cursor: string | null }> {
  const rows: BackupRow[] = [];
  const seenAtCursor = new Set<string>();
  let since = cursor;
  let inclusive = false;
  for (;;) {
    const page = await remote.pull(REMOTE_TABLES[table], since, inclusive, pageSize);
    // Later pages start *at* the last timestamp (rows may share it); skip the ones already read.
    const fresh = page.filter(
      (row) => !(String(row.server_updated_at) === since && seenAtCursor.has(rowKey(table, row))),
    );
    for (const row of fresh) {
      const at = String(row.server_updated_at);
      if (at !== since) seenAtCursor.clear();
      since = at;
      seenAtCursor.add(rowKey(table, row));
      rows.push(toLocalRow(row));
    }
    if (page.length < pageSize || fresh.length === 0) break;
    inclusive = true;
  }
  return { rows: pushableRows(table, rows), cursor: since };
}

/**
 * Queues the local rows the cloud does not have at all, for the next push, and returns how
 * many. Heals devices whose rows never reached the cloud (clock-based pushes before the
 * outbox). Only keys are read; rows the cloud has — maybe newer — are never overwritten.
 */
export async function queueMissing(local: BackupRepository, remote: RemoteStore): Promise<number> {
  const remoteKeys = {} as Record<BackupTable, ReadonlySet<string>>;
  for (const table of SYNC_ORDER)
    remoteKeys[table] = new Set(await remote.keys(REMOTE_TABLES[table]));
  return local.enqueueMissing(remoteKeys);
}

/**
 * One sync round: push the local changes waiting in the outbox, then pull remote changes since
 * the per-table cursors and apply them (the server's order wins, see `planRemoteApply`).
 * Idempotent: running it twice in a row pushes/pulls nothing new, and a round interrupted at
 * any point (network, app closed) is simply redone by the next one — the outbox is only cleared
 * once the server accepted the rows, and cursors only move with applied rows.
 */
export async function runSync(
  local: BackupRepository,
  remote: RemoteStore,
  state: SyncState,
  pageSize = PULL_PAGE,
): Promise<SyncResult> {
  const pending = await local.pendingChanges();
  let pushed = 0;
  for (const table of SYNC_ORDER) {
    const rows = pushableRows(table, pending.tables[table]);
    for (const part of chunk(rows, PUSH_CHUNK)) {
      await remote.upsert(REMOTE_TABLES[table], part.map(toRemoteRow));
      pushed += part.length;
    }
  }
  await local.markPushed(pending.upTo);

  const incoming = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as Record<
    BackupTable,
    BackupRow[]
  >;
  const cursors = { ...state.cursors };
  let pulled = 0;
  for (const table of SYNC_ORDER) {
    const result = await pullTable(remote, table, state.cursors[table] ?? null, pageSize);
    incoming[table] = result.rows;
    pulled += result.rows.length;
    if (result.cursor !== null) cursors[table] = result.cursor;
  }
  const applied =
    pulled > 0 ? await local.applyRemote(incoming) : { inserted: 0, updated: 0, skipped: 0 };

  return { state: { ...state, cursors }, pushed, pulled, applied };
}
