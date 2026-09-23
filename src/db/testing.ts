import initSqlJs, { type BindParams, type Database as SqlJsDatabase } from 'sql.js';

import type { Database } from './client';
import { prepareDatabase, type MigrationBundle, type MigrationDatabase } from './migrate';
import { createSerializedDatabase } from './transactions';

/** Runs a statement and returns its rows as objects. */
function allRows(sqlite: SqlJsDatabase, sql: string, params: unknown[]): Record<string, unknown>[] {
  const statement = sqlite.prepare(sql);
  try {
    statement.bind(params as BindParams);
    const rows: Record<string, unknown>[] = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

/** expo-sqlite's async API (the subset used by the migrator) on top of sql.js. */
export function migrationAdapter(sqlite: SqlJsDatabase): MigrationDatabase {
  const adapter: MigrationDatabase = {
    async execAsync(source: string) {
      sqlite.exec(source);
    },
    async getFirstAsync(source: string, ...params: unknown[]) {
      return (allRows(sqlite, source, params.flat())[0] ?? null) as never;
    },
    async runAsync(source: string, ...params: unknown[]) {
      allRows(sqlite, source, params.flat());
      return { lastInsertRowId: 0, changes: sqlite.getRowsModified() };
    },
    async withTransactionAsync(task: () => Promise<void>) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as MigrationDatabase;
  return adapter;
}

export interface TestDatabase {
  db: Database;
  /** The underlying sql.js database, for raw SQL (EXPLAIN QUERY PLAN, PRAGMA…). */
  sqlite: SqlJsDatabase;
  /** Every statement Drizzle sent, in order (with its parameters). */
  queries: { sql: string; params: unknown[] }[];
}

/** Drizzle with the app's statement queue (see `createSerializedDatabase`) on sql.js. */
export function wrapSqlJs(sqlite: SqlJsDatabase): TestDatabase {
  const queries: TestDatabase['queries'] = [];
  const db = createSerializedDatabase(async (sql, params, method) => {
    queries.push({ sql, params });
    const statement = sqlite.prepare(sql);
    try {
      statement.bind(params as BindParams);
      const rows: unknown[][] = [];
      while (statement.step()) rows.push(statement.get());
      if (method === 'run') return { rows: [] };
      if (method === 'get') return { rows: rows[0] as unknown[] };
      return { rows };
    } finally {
      statement.free();
    }
  });
  return { db, sqlite, queries };
}

/**
 * Test-only: a real SQLite database in memory (sql.js / WebAssembly) behind the same Drizzle
 * sqlite-proxy driver, the same setup (pragmas + migrator) as the app.
 */
export async function openTestDatabase(bundle?: MigrationBundle): Promise<TestDatabase> {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  await prepareDatabase(migrationAdapter(sqlite), bundle);
  return wrapSqlJs(sqlite);
}

export async function createTestDatabase(): Promise<Database> {
  return (await openTestDatabase()).db;
}
