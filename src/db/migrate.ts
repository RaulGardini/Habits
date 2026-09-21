import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations';
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

interface MigrationBundle {
  journal: { entries: JournalEntry[] };
  migrations: Record<string, string>;
}

/**
 * Applies the drizzle-kit migrations bundled in `./migrations` (generated with
 * `npm run db:generate`). Same bookkeeping as Drizzle's own migrator: a migration runs when its
 * journal timestamp is newer than the last applied one. Each migration runs in a transaction.
 */
export async function runMigrations(sqlite: SQLiteDatabase): Promise<void> {
  const bundle = migrations as MigrationBundle;

  await sqlite.execAsync(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )`,
  );
  const last = await sqlite.getFirstAsync<{ created_at: number }>(
    `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
  );
  const lastApplied = last ? Number(last.created_at) : -1;

  for (const entry of bundle.journal.entries) {
    if (entry.when <= lastApplied) continue;
    const key = `m${entry.idx.toString().padStart(4, '0')}`;
    const sql = bundle.migrations[key];
    if (sql === undefined) throw new Error(`Missing migration: ${entry.tag}`);

    const statements = sql
      .split(STATEMENT_BREAKPOINT)
      .map((statement) => statement.trim())
      .filter(Boolean);

    await sqlite.withTransactionAsync(async () => {
      for (const statement of statements) await sqlite.execAsync(statement);
      await sqlite.runAsync(
        `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
        entry.tag,
        entry.when,
      );
    });
  }
}
