import type { SupabaseClient } from '@supabase/supabase-js';

import type { BackupFile } from '@/core/backup/backup';
import type { CloudBackupInfo } from '@/core/backup/cloudBackup';

const TABLE = 'cloud_backups';

/** Snapshots in `public.cloud_backups` (RLS: only the signed-in user's rows). */
export function createCloudBackups(client: SupabaseClient) {
  return {
    async list(): Promise<CloudBackupInfo[]> {
      const { data, error } = await client
        .from(TABLE)
        .select('id, created_at, row_count')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        rowCount: Number(row.row_count),
      }));
    },

    async create(content: BackupFile, rowCount: number): Promise<void> {
      const { error } = await client.from(TABLE).insert({ content, row_count: rowCount });
      if (error) throw new Error(error.message);
    },

    async get(id: string): Promise<BackupFile> {
      const { data, error } = await client.from(TABLE).select('content').eq('id', id).single();
      if (error) throw new Error(error.message);
      return data.content as BackupFile;
    },

    async remove(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      const { error } = await client
        .from(TABLE)
        .delete()
        .in('id', [...ids]);
      if (error) throw new Error(error.message);
    },
  };
}
