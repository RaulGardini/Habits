import {
  backupFileName,
  createBackup,
  parseBackup,
  type ImportSummary,
} from '@/core/backup/backup';
import { todayLocal } from '@/core/dates/localDate';
import { pickBackupFile, saveBackupFile } from '@/lib/backupFile';
import { cancelAllReminders, syncReminders } from '@/lib/notifications';
import { getRepositories } from '@/repositories';

import { useEntriesStore } from './entriesStore';
import { useHabitsStore } from './habitsStore';
import { usePlannerStore } from './plannerStore';
import { useSettingsStore } from './settingsStore';
import { useTimerStore } from './timerStore';

/** Reloads every store from the database after a bulk change (import / delete all). */
async function reloadAll(): Promise<void> {
  useEntriesStore.getState().reset();
  usePlannerStore.getState().bump();
  await Promise.all([
    useSettingsStore.getState().load(),
    useHabitsStore.getState().load(),
    useTimerStore.getState().load(),
  ]);
}

/** Exports all data to a JSON file (share sheet on mobile, download on web). */
export async function exportBackup(): Promise<void> {
  const tables = await getRepositories().backup.exportAll();
  const content = JSON.stringify(createBackup(tables, new Date()), null, 2);
  await saveBackupFile(backupFileName(todayLocal()), content);
}

/**
 * Lets the user pick a backup and merges it (newer changes win). Returns null when cancelled.
 * Throws `BackupError` (with a user-facing message) for invalid files.
 */
export async function importBackup(): Promise<ImportSummary | null> {
  const json = await pickBackupFile();
  if (json === null) return null;
  const backup = parseBackup(json);
  const summary = await getRepositories().backup.importMerge(backup.tables);
  await reloadAll();
  await syncReminders(useHabitsStore.getState().habits);
  return summary;
}

/** Permanently deletes everything and returns the app to its initial state. */
export async function deleteAllData(): Promise<void> {
  await useTimerStore.getState().clear();
  await getRepositories().backup.deleteAll();
  await cancelAllReminders();
  await reloadAll();
}
