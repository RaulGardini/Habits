import { drizzle } from 'drizzle-orm/sqlite-proxy';
import initSqlJs, { type BindParams } from 'sql.js';

import type { Database } from './client';
import migrations from './migrations/migrations';
import * as schema from './schema';

/**
 * Test-only: a real SQLite database in memory (sql.js / WebAssembly) behind the same Drizzle
 * sqlite-proxy driver and the same migrations as the app. Lets repository tests run in Jest.
 */
export async function createTestDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON;');

  const bundle = migrations as {
    journal: { entries: { idx: number }[] };
    migrations: Record<string, string>;
  };
  for (const entry of bundle.journal.entries) {
    const sql = bundle.migrations[`m${entry.idx.toString().padStart(4, '0')}`] ?? '';
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.run(statement);
    }
  }

  return drizzle(
    async (sql, params, method) => {
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
    },
    { schema },
  );
}
