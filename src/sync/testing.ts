import type { RemoteStore } from './engine';

/**
 * In-memory stand-in for the Supabase tables of ONE user, with the same rules as
 * supabase/schema.sql: last-write-wins guard on `updated_at` and a monotonic
 * `server_updated_at` set on every accepted write. Test-only.
 */
export function createFakeRemote(): RemoteStore & {
  rows(table: string): Record<string, unknown>[];
  failNext(): void;
} {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let clock = 0;
  let fail = false;
  const tableOf = (name: string) => {
    let table = tables.get(name);
    if (!table) tables.set(name, (table = new Map()));
    return table;
  };
  const keyOf = (name: string, row: Record<string, unknown>) =>
    String(name === 'settings' ? row.key : row.id);
  const serverTime = () => `2026-01-01T00:00:00.${String(++clock).padStart(6, '0')}+00:00`;
  const check = () => {
    if (fail) {
      fail = false;
      throw new Error('network error');
    }
  };

  return {
    async upsert(name, rows) {
      check();
      const table = tableOf(name);
      for (const row of rows) {
        const key = keyOf(name, row);
        const existing = table.get(key);
        if (existing && String(row.updated_at) <= String(existing.updated_at)) continue;
        table.set(key, { ...row, user_id: 'user', server_updated_at: serverTime() });
      }
    },
    async pull(name, since, inclusive, limit) {
      check();
      return [...tableOf(name).values()]
        .filter((row) => {
          if (since === null) return true;
          const at = String(row.server_updated_at);
          return inclusive ? at >= since : at > since;
        })
        .sort((a, b) => String(a.server_updated_at).localeCompare(String(b.server_updated_at)))
        .slice(0, limit);
    },
    async deleteAll() {
      check();
      tables.clear();
    },
    rows(name) {
      return [...tableOf(name).values()];
    },
    failNext() {
      fail = true;
    },
  };
}
