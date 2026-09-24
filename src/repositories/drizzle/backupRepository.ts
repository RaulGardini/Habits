import { eq, getTableColumns, inArray, lte } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  mergeKey,
  planMerge,
  type BackupRow,
  type BackupTable,
  type ImportSummary,
} from '@/core/backup/backup';
import type { Database } from '@/db/client';
import {
  dayNotes,
  events,
  goals,
  habitEntries,
  habitReminders,
  habits,
  settings,
  syncOutbox,
  syncPause,
  tasks,
} from '@/db/schema';
import { LOCAL_ONLY_SETTINGS, planRemoteApply } from '@/core/sync/sync';

import type { BackupRepository } from '../types';

/** Backup tables in dependency order (parents before children). */
const TABLES: Record<BackupTable, SQLiteTable> = {
  habits,
  habitReminders,
  habitEntries,
  tasks,
  events,
  dayNotes,
  goals,
  settings,
};
const IMPORT_ORDER: BackupTable[] = [
  'habits',
  'habitReminders',
  'habitEntries',
  'tasks',
  'events',
  'dayNotes',
  'goals',
  'settings',
];

/** Keeps only real columns of the table (a backup may carry unknown fields). */
function sanitize(table: SQLiteTable, row: BackupRow): Record<string, unknown> {
  const columns = Object.keys(getTableColumns(table));
  return Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]]));
}

/** Column that identifies a stored row (settings use `key`, everything else `id`). */
function identity(name: BackupTable): { column: string } {
  return { column: name === 'settings' ? 'key' : 'id' };
}

export function createDrizzleBackupRepository(db: Database): BackupRepository {
  /** Queues the local rows that pass `keep` (settings: never the device-only ones). */
  async function enqueue(keep: (table: BackupTable, key: string) => boolean): Promise<number> {
    let queued = 0;
    await db.transaction(async (tx) => {
      for (const name of IMPORT_ORDER) {
        const table = TABLES[name];
        const idColumn = getTableColumns(table)[identity(name).column] as SQLiteColumn;
        const rows = (await tx.select({ key: idColumn }).from(table)) as { key: string }[];
        const keys = rows
          .map((row) => String(row.key))
          .filter((key) => name !== 'settings' || !LOCAL_ONLY_SETTINGS.has(key))
          .filter((key) => keep(name, key));
        queued += keys.length;
        for (let i = 0; i < keys.length; i += 500) {
          await tx
            .insert(syncOutbox)
            .values(keys.slice(i, i + 500).map((rowKey) => ({ tableName: name, rowKey })))
            .onConflictDoNothing();
        }
      }
    });
    return queued;
  }

  return {
    async exportAll() {
      const result = {} as Record<BackupTable, BackupRow[]>;
      for (const name of IMPORT_ORDER) {
        result[name] = (await db.select().from(TABLES[name])) as BackupRow[];
      }
      return result;
    },

    async pendingChanges() {
      const queued = await db.select().from(syncOutbox);
      const tables = Object.fromEntries(
        IMPORT_ORDER.map((name) => [name, []]),
      ) as unknown as Record<BackupTable, BackupRow[]>;
      let upTo = 0;
      const keysByTable = new Map<BackupTable, string[]>();
      for (const { seq, tableName, rowKey } of queued) {
        upTo = Math.max(upTo, seq);
        if (!(tableName in TABLES)) continue;
        const name = tableName as BackupTable;
        keysByTable.set(name, [...(keysByTable.get(name) ?? []), rowKey]);
      }
      for (const [name, keys] of keysByTable) {
        const table = TABLES[name];
        const idColumn = getTableColumns(table)[identity(name).column] as SQLiteColumn;
        for (let i = 0; i < keys.length; i += 500) {
          const rows = (await db
            .select()
            .from(table)
            .where(inArray(idColumn, keys.slice(i, i + 500)))) as BackupRow[];
          tables[name].push(...rows);
        }
      }
      return { upTo, tables };
    },

    async markPushed(upTo) {
      await db.delete(syncOutbox).where(lte(syncOutbox.seq, upTo));
    },

    async enqueueAll() {
      await enqueue(() => true);
    },

    async enqueueMissing(remoteKeys) {
      return enqueue((name, key) => !remoteKeys[name].has(key));
    },

    async applyRemote(tables) {
      const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0 };
      await db.transaction(async (tx) => {
        // Rows written here came from the cloud: the outbox triggers must not queue them back.
        await tx.insert(syncPause).values({ id: 1 }).onConflictDoNothing();
        const pending = new Set(
          (await tx.select().from(syncOutbox)).map((row) => `${row.tableName}|${row.rowKey}`),
        );
        let habitIds: Set<string> | null = null;
        for (const name of IMPORT_ORDER) {
          let incoming = tables[name];
          if (incoming.length === 0) continue;
          const table = TABLES[name];
          const id = identity(name).column;
          const idColumn = getTableColumns(table)[id] as SQLiteColumn;
          // Children of habits that are not in the database would violate the foreign key.
          if (name === 'habitEntries' || name === 'habitReminders') {
            habitIds ??= new Set(
              ((await tx.select({ id: habits.id }).from(habits)) as { id: string }[]).map(
                (row) => row.id,
              ),
            );
            const known = habitIds;
            const before = incoming.length;
            incoming = incoming.filter((row) => known.has(String(row.habitId)));
            summary.skipped += before - incoming.length;
          }
          const existing = (await tx.select().from(table)) as BackupRow[];
          const plan = planRemoteApply(
            existing,
            incoming,
            mergeKey(name),
            (row) => pending.has(`${name}|${String(row[id])}`),
            id,
          );
          summary.skipped += plan.skipped;
          for (const row of plan.toInsert) {
            await tx.insert(table).values(sanitize(table, row) as never);
            summary.inserted += 1;
          }
          for (const { existing: current, incoming: row } of plan.toUpdate) {
            // Keep the local identity (ids may differ when matched by a natural key).
            const values = sanitize(table, row);
            delete values[id];
            await tx
              .update(table)
              .set(values as never)
              .where(eq(idColumn, current[id] as string));
            summary.updated += 1;
          }
          if (name === 'habits') habitIds = null;
        }
        await tx.delete(syncPause);
      });
      return summary;
    },

    async importMerge(tables) {
      const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0 };
      await db.transaction(async (tx) => {
        let habitIds = new Set<string>();
        for (const name of IMPORT_ORDER) {
          const table = TABLES[name];
          const idColumn = getTableColumns(table)[identity(name).column] as SQLiteColumn;
          const existing = (await tx.select().from(table)) as BackupRow[];
          let incoming = tables[name];
          // Children of habits that are not in the database would violate the foreign key.
          if (name === 'habitEntries' || name === 'habitReminders') {
            const before = incoming.length;
            incoming = incoming.filter((row) => habitIds.has(String(row.habitId)));
            summary.skipped += before - incoming.length;
          }

          const plan = planMerge(existing, incoming, mergeKey(name));
          summary.skipped += plan.skipped;
          for (const row of plan.toInsert) {
            await tx.insert(table).values(sanitize(table, row) as never);
            summary.inserted += 1;
          }
          for (const { existing: current, incoming: row } of plan.toUpdate) {
            // Keep the local identity (ids may differ when matched by a natural key).
            const values = sanitize(table, row);
            delete values[identity(name).column];
            await tx
              .update(table)
              .set(values as never)
              .where(eq(idColumn, current[identity(name).column] as string));
            summary.updated += 1;
          }

          if (name === 'habits') {
            const rows = (await tx.select({ id: habits.id }).from(habits)) as { id: string }[];
            habitIds = new Set(rows.map((r) => r.id));
          }
        }
      });
      return summary;
    },

    async deleteAll() {
      await db.transaction(async (tx) => {
        // Children first because of the foreign keys.
        for (const name of [...IMPORT_ORDER].reverse()) {
          await tx.delete(TABLES[name]);
        }
        await tx.delete(syncOutbox);
      });
    },
  };
}
