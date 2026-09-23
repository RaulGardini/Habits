import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

/**
 * Makes `db.transaction` run one transaction at a time. The app has a single SQLite connection,
 * so a second `BEGIN` while another transaction is open fails ("cannot start a transaction
 * within a transaction") — e.g. saving a habit while a sync merge is running.
 * Nested `tx.transaction` calls use savepoints and are unaffected; code inside a transaction
 * must use `tx`, never the outer `db.transaction` (it would wait for itself).
 */
export function serializeTransactions<T extends SqliteRemoteDatabase<Record<string, unknown>>>(
  db: T,
): T {
  const transaction = db.transaction.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.transaction = ((run, config) => {
    const result = queue.then(() => transaction(run, config));
    queue = result.catch(() => undefined);
    return result;
  }) as T['transaction'];
  return db;
}
