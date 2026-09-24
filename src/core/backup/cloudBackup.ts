import { pushableRows } from '@/core/sync/sync';

import {
  BACKUP_TABLES,
  createBackup,
  type BackupFile,
  type BackupRow,
  type BackupTable,
} from './backup';

/** An automatic cloud backup is taken when the newest one is at least this old. */
export const CLOUD_BACKUP_INTERVAL_DAYS = 7;
/**
 * How many cloud backups are kept (older ones are deleted): three weeks to undo a mistake. Each
 * copy is a full snapshot, so this is the main factor in cloud storage per user.
 */
export const CLOUD_BACKUPS_KEPT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CloudBackupInfo {
  id: string;
  /** ISO instant. */
  createdAt: string;
  rowCount: number;
}

export function isCloudBackupDue(latestAt: string | null, now: Date): boolean {
  if (latestAt === null) return true;
  return now.getTime() - new Date(latestAt).getTime() >= CLOUD_BACKUP_INTERVAL_DAYS * DAY_MS;
}

/** Ids to delete so only the newest `keep` backups remain. */
export function backupsToPrune(
  backups: readonly CloudBackupInfo[],
  keep = CLOUD_BACKUPS_KEPT,
): string[] {
  return [...backups]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(keep)
    .map((backup) => backup.id);
}

/** Snapshot for the cloud: every table, without this device's own settings. */
export function cloudSnapshot(tables: Record<BackupTable, BackupRow[]>, now: Date): BackupFile {
  const clean = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, pushableRows(table, tables[table] ?? [])]),
  ) as Record<BackupTable, BackupRow[]>;
  return createBackup(clean, now);
}

export function countRows(tables: Record<BackupTable, BackupRow[]>): number {
  return BACKUP_TABLES.reduce((sum, table) => sum + (tables[table]?.length ?? 0), 0);
}

/**
 * Rows to merge for a restore: the snapshot's rows stamped with `nowIso`, so they win the
 * last-write-wins merge locally and on every synced device. Items changed or deleted after the
 * snapshot come back as they were; items created after it are kept.
 */
export function restoreRows(
  tables: Record<BackupTable, BackupRow[]>,
  nowIso: string,
): Record<BackupTable, BackupRow[]> {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [
      table,
      pushableRows(table, tables[table] ?? []).map((row) => ({ ...row, updatedAt: nowIso })),
    ]),
  ) as Record<BackupTable, BackupRow[]>;
}
