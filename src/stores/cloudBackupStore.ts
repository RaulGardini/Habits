import { create } from 'zustand';

import { parseBackup } from '@/core/backup/backup';
import {
  backupsToPrune,
  cloudSnapshot,
  countRows,
  isCloudBackupDue,
  restoreRows,
  type CloudBackupInfo,
} from '@/core/backup/cloudBackup';
import { getRepositories } from '@/repositories';
import { supabase } from '@/sync/client';
import { createCloudBackups } from '@/sync/cloudBackups';

import { reloadAll } from './dataActions';
import { rescheduleReminders } from './reminders';
import { useSyncStore } from './syncStore';
import { t } from '@/i18n/i18n';
import { hapticSuccess } from '@/lib/haptics';
import { logError } from '@/lib/log';

/** Automatic checks run at most this often per app session (the backup itself is weekly). */
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface CloudBackupState {
  /** Newest first; null until loaded. */
  backups: CloudBackupInfo[] | null;
  busy: boolean;
  error: string | null;
  refresh(): Promise<void>;
  /** Takes a snapshot now and prunes old ones. */
  backupNow(): Promise<void>;
  /** Weekly automatic snapshot (called after each successful sync). Never throws. */
  autoBackup(): Promise<void>;
  /** Saves the current state, then brings back everything the snapshot had. */
  restore(id: string): Promise<void>;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/cloud_backups/.test(message) && /(does not exist|schema cache|not find)/i.test(message)) {
    return t('Falta criar a tabela de backups no Supabase (veja docs/SUPABASE.md).');
  }
  if (/network|fetch/i.test(message)) return t('Sem conexão com o servidor.');
  return t('Não foi possível concluir. Tente novamente.');
}

let lastAutoCheck = 0;

export const useCloudBackupStore = create<CloudBackupState>()((set, get) => {
  const api = () => {
    if (!supabase || !useSyncStore.getState().userId) throw new Error('Not signed in');
    return createCloudBackups(supabase);
  };

  const snapshot = async () => {
    const cloud = api();
    const tables = await getRepositories().backup.exportAll();
    const file = cloudSnapshot(tables, new Date());
    await cloud.create(file, countRows(file.tables));
    const list = await cloud.list();
    await cloud.remove(backupsToPrune(list));
    set({ backups: await cloud.list() });
  };

  return {
    backups: null,
    busy: false,
    error: null,

    async refresh() {
      try {
        set({ backups: await api().list(), error: null });
      } catch (error) {
        set({ error: friendlyError(error) });
      }
    },

    async backupNow() {
      set({ busy: true, error: null });
      try {
        await snapshot();
        hapticSuccess();
      } catch (error) {
        logError('Cloud backup failed', error);
        set({ error: friendlyError(error) });
        throw error;
      } finally {
        set({ busy: false });
      }
    },

    async autoBackup() {
      if (!supabase || !useSyncStore.getState().userId || get().busy) return;
      if (Date.now() - lastAutoCheck < AUTO_CHECK_INTERVAL_MS) return;
      lastAutoCheck = Date.now();
      try {
        const list = await api().list();
        set({ backups: list });
        if (isCloudBackupDue(list[0]?.createdAt ?? null, new Date())) await snapshot();
      } catch (error) {
        logError('Automatic cloud backup failed', error);
        set({ error: friendlyError(error) });
      }
    },

    async restore(id) {
      set({ busy: true, error: null });
      try {
        const cloud = api();
        const file = parseBackup(JSON.stringify(await cloud.get(id)));
        // Safety net: the current state becomes a backup too, so a restore can be undone.
        await snapshot();
        await getRepositories().backup.importMerge(
          restoreRows(file.tables, new Date().toISOString()),
        );
        await reloadAll();
        await rescheduleReminders();
        await useSyncStore.getState().syncNow();
        hapticSuccess();
      } catch (error) {
        logError('Cloud restore failed', error);
        set({ error: friendlyError(error) });
        throw error;
      } finally {
        set({ busy: false });
      }
    },
  };
});
