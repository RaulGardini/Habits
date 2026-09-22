import type { SupabaseClient } from '@supabase/supabase-js';

import { REMOTE_TABLES } from '@/core/sync/sync';

import type { RemoteStore } from './engine';

/** RemoteStore over the Supabase tables of supabase/schema.sql (RLS scopes them to the user). */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  const conflictTarget = (table: string) => (table === 'settings' ? 'user_id,key' : 'user_id,id');

  return {
    async upsert(table, rows) {
      if (rows.length === 0) return;
      const { error } = await client.from(table).upsert(
        rows.map((row) => ({ ...row, user_id: userId })),
        { onConflict: conflictTarget(table) },
      );
      if (error) throw new Error(error.message);
    },

    async pull(table, since, inclusive, limit) {
      let query = client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .limit(limit);
      if (since !== null) {
        query = inclusive
          ? query.gte('server_updated_at', since)
          : query.gt('server_updated_at', since);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, unknown>[];
    },

    async deleteAll() {
      for (const table of Object.values(REMOTE_TABLES)) {
        const { error } = await client.from(table).delete().eq('user_id', userId);
        if (error) throw new Error(error.message);
      }
    },
  };
}
