import type { SupabaseClient } from '@supabase/supabase-js';

import { REMOTE_TABLES } from '@/core/sync/sync';

import type { RemoteStore } from './engine';

/** Rows per request when listing keys (the API caps responses at 1,000). */
const KEYS_PAGE = 1000;

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

    async keys(table) {
      const column = table === 'settings' ? 'key' : 'id';
      const keys: string[] = [];
      // Page by page: the API returns at most 1,000 rows per request.
      for (let from = 0; ; from += KEYS_PAGE) {
        const { data, error } = await client
          .from(table)
          .select(column)
          .order(column, { ascending: true })
          .range(from, from + KEYS_PAGE - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as unknown as Record<string, unknown>[];
        keys.push(...page.map((row) => String(row[column])));
        if (page.length < KEYS_PAGE) return keys;
      }
    },

    async deleteAll() {
      for (const table of [...Object.values(REMOTE_TABLES), 'cloud_backups']) {
        const { error } = await client.from(table).delete().eq('user_id', userId);
        // `cloud_backups` may not exist yet in older setups of supabase/schema.sql.
        if (error && !(table === 'cloud_backups' && /cloud_backups/.test(error.message))) {
          throw new Error(error.message);
        }
      }
    },
  };
}
