import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations';
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

export interface MigrationBundle {
  journal: { entries: JournalEntry[] };
  migrations: Record<string, string>;
}

/** The part of expo-sqlite's async API the migrator needs (lets tests run it on sql.js). */
export type MigrationDatabase = Pick<
  SQLiteDatabase,
  'execAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'
>;

export const bundledMigrations = migrations as MigrationBundle;

/**
 * Applies the drizzle-kit migrations bundled in `./migrations` (generated with
 * `npm run db:generate`). Same bookkeeping as Drizzle's own migrator: a migration runs when its
 * journal timestamp is newer than the last applied one. Each migration runs in a transaction,
 * so a failure leaves the database exactly as the previous migration left it (SQLite DDL is
 * transactional) and the migration is retried on the next start.
 */
export async function runMigrations(
  sqlite: MigrationDatabase,
  bundle: MigrationBundle = bundledMigrations,
): Promise<void> {
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

/**
 * Per-connection setup + migrations, shared by the app (`openDatabase`) and the tests.
 * Foreign keys are off by default in SQLite and must be enabled on every connection, outside
 * a transaction.
 */
export async function prepareDatabase(
  sqlite: MigrationDatabase,
  bundle: MigrationBundle = bundledMigrations,
): Promise<void> {
  await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(sqlite, bundle);
}
