import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';

import { prepareDatabase } from './migrate';
import type * as schema from './schema';
import { createSerializedDatabase } from './transactions';

export const DATABASE_NAME = 'habits.db';

export type Database = SqliteRemoteDatabase<typeof schema>;

/**
 * Drizzle on top of expo-sqlite's *async* API (via the sqlite-proxy driver), on every platform.
 *
 * Why not `drizzle-orm/expo-sqlite`? That driver only uses expo-sqlite's synchronous API, which
 * on web (alpha) is broken: results over 255 bytes arrive truncated and slow operations time
 * out. The async API works everywhere and does not block the JS thread on native either.
 */
function createDrizzle(sqlite: SQLiteDatabase): Database {
  return createSerializedDatabase(async (sql, params, method) => {
    const statement = await sqlite.prepareAsync(sql);
    try {
      const result = await statement.executeForRawResultAsync(params as SQLiteBindValue[]);
      if (method === 'run') return { rows: [] };
      // For `get`, Drizzle expects the single row itself (null when there is none).
      if (method === 'get') return { rows: (await result.getFirstAsync()) as unknown[] };
      return { rows: await result.getAllAsync() };
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/** Opens the database and applies pending migrations. */
export async function openDatabase(name = DATABASE_NAME): Promise<Database> {
  const sqlite = await openDatabaseAsync(name);
  await prepareDatabase(sqlite);
  return createDrizzle(sqlite);
}
