import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy';

import type { Database } from './client';
import * as schema from './schema';

/**
 * Drizzle over ONE SQLite connection where every statement goes through a single queue:
 *
 * - statements run one at a time, in the order they were issued;
 * - a transaction holds the queue from `BEGIN` to `COMMIT`/`ROLLBACK`. On a shared connection
 *   anything issued meanwhile (a check tapped during a sync merge) would otherwise run *inside*
 *   that transaction and vanish with its rollback; a second `BEGIN` would fail ("cannot start
 *   a transaction within a transaction").
 *
 * Inside `db.transaction(async (tx) => …)` use `tx` only: the outer `db` waits for the
 * transaction to finish, so calling it there would wait forever.
 */
export function createSerializedDatabase(execute: RemoteCallback): Database {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  };

  const db = drizzle((sql, params, method) => exclusive(() => execute(sql, params, method)), {
    schema,
  });
  // Transactions run on a second Drizzle instance that talks to the connection directly: it is
  // only ever used while the queue is held.
  const direct = drizzle(execute, { schema });
  db.transaction = ((run, config) =>
    exclusive(() => direct.transaction(run, config))) as Database['transaction'];
  return db;
}
