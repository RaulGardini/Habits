import { sql } from 'drizzle-orm';

import type { HabitDraft } from '@/core/habits/types';
import { createDrizzleRepositories } from '@/repositories/drizzle';

import { bundledMigrations, prepareDatabase, type MigrationBundle } from './migrate';
import { migrationAdapter, openTestDatabase, wrapSqlJs } from './testing';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

const draft = (patch: Partial<HabitDraft> = {}): HabitDraft => ({
  name: 'Ler',
  icon: 'book-open-variant',
  color: 'blue',
  timeOfDay: 'evening',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-01-01',
  reminders: ['21:00'],
  ...patch,
});

/** The bundled migrations up to (and including) `lastIdx`. */
function bundleUpTo(lastIdx: number): MigrationBundle {
  return {
    journal: {
      entries: bundledMigrations.journal.entries.filter((entry) => entry.idx <= lastIdx),
    },
    migrations: bundledMigrations.migrations,
  };
}

/** Drizzle wraps SQLite errors ("Failed query: …"); the original one is the `cause`. */
async function sqliteError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    return String(cause instanceof Error ? cause.message : error);
  }
  throw new Error('Expected the operation to fail');
}

const scalar = (sqlite: { exec(sql: string): { values: unknown[][] }[] }, sql: string) =>
  sqlite.exec(sql)[0]?.values[0]?.[0];

describe('migrations', () => {
  it('upgrades a populated v1 database without losing data', async () => {
    const { sqlite } = await openTestDatabase(bundleUpTo(0));
    const now = '2024-01-01T00:00:00.000Z';
    sqlite.run(
      `INSERT INTO habits (id, name, icon, color, start_date, created_at, updated_at)
       VALUES ('h1', 'Água', 'cup-water', 'blue', '2024-01-01', ?, ?)`,
      [now, now],
    );
    for (let day = 1; day <= 28; day++) {
      const date = `2024-02-${String(day).padStart(2, '0')}`;
      sqlite.run(
        `INSERT INTO habit_entries (id, habit_id, date, status, created_at, updated_at)
         VALUES (?, 'h1', ?, 'done', ?, ?)`,
        [`e${day}`, date, now, now],
      );
    }

    await prepareDatabase(migrationAdapter(sqlite));

    expect(scalar(sqlite, 'SELECT count(*) FROM habit_entries')).toBe(28);
    expect(sqlite.exec('SELECT name, quantity_step FROM habits')[0]?.values).toEqual([
      ['Água', null],
    ]);
    // Tables and columns added by later migrations exist and have their defaults.
    sqlite.run(
      `INSERT INTO events (id, title, date, start_time, color, created_at, updated_at)
       VALUES ('ev', 'Consulta', '2024-03-01', '10:00', 'red', ?, ?)`,
      [now, now],
    );
    expect(sqlite.exec('SELECT all_day, repeat, excluded_dates FROM events')[0]?.values).toEqual([
      [0, 'none', ''],
    ]);
    expect(scalar(sqlite, 'SELECT count(*) FROM __drizzle_migrations')).toBe(
      bundledMigrations.journal.entries.length,
    );

    // Data written through the repositories after the upgrade reads back fine.
    const repos = createDrizzleRepositories(wrapSqlJs(sqlite).db);
    expect(await repos.entries.listByHabit('h1')).toHaveLength(28);
  });

  it('is a no-op when everything is applied', async () => {
    const { sqlite } = await openTestDatabase();
    await prepareDatabase(migrationAdapter(sqlite));
    expect(scalar(sqlite, 'SELECT count(*) FROM __drizzle_migrations')).toBe(
      bundledMigrations.journal.entries.length,
    );
  });

  it('rolls back a migration that fails halfway and retries it next time', async () => {
    const { sqlite } = await openTestDatabase();
    const now = '2024-01-01T00:00:00.000Z';
    sqlite.run(
      `INSERT INTO habits (id, name, icon, color, start_date, created_at, updated_at)
       VALUES ('h1', 'Água', 'cup-water', 'blue', '2024-01-01', ?, ?)`,
      [now, now],
    );
    const applied = Number(scalar(sqlite, 'SELECT count(*) FROM __drizzle_migrations'));
    const lastWhen = Math.max(...bundledMigrations.journal.entries.map((e) => e.when));
    const withNext = (sql: string): MigrationBundle => ({
      journal: {
        entries: [
          ...bundledMigrations.journal.entries,
          { idx: 99, when: lastWhen + 1, tag: '0099_test' },
        ],
      },
      migrations: { ...bundledMigrations.migrations, m0099: sql },
    });

    const broken = withNext(
      [
        'ALTER TABLE `habits` ADD `mood` text;',
        "UPDATE `habits` SET `name` = 'corrompido';",
        'ALTER TABLE `does_not_exist` ADD `x` text;',
      ].join('--> statement-breakpoint\n'),
    );
    await expect(prepareDatabase(migrationAdapter(sqlite), broken)).rejects.toThrow();

    // Nothing from the failed migration survived: no column, no data change, not recorded.
    const columns = sqlite.exec('PRAGMA table_info(habits)')[0]?.values.map((c) => c[1]);
    expect(columns).not.toContain('mood');
    expect(scalar(sqlite, 'SELECT name FROM habits')).toBe('Água');
    expect(Number(scalar(sqlite, 'SELECT count(*) FROM __drizzle_migrations'))).toBe(applied);

    // The fixed migration applies on the next start.
    await prepareDatabase(
      migrationAdapter(sqlite),
      withNext('ALTER TABLE `habits` ADD `mood` text;'),
    );
    expect(sqlite.exec('PRAGMA table_info(habits)')[0]?.values.map((c) => c[1])).toContain('mood');
    expect(Number(scalar(sqlite, 'SELECT count(*) FROM __drizzle_migrations'))).toBe(applied + 1);
  });
});

describe('migrations, one version at a time', () => {
  it('keeps the data through every intermediate version', async () => {
    const { sqlite } = await openTestDatabase(bundleUpTo(0));
    const now = '2024-01-01T00:00:00.000Z';
    sqlite.run(
      `INSERT INTO habits (id, name, icon, color, start_date, created_at, updated_at)
       VALUES ('h1', 'Água', 'cup-water', 'blue', '2024-01-01', ?, ?)`,
      [now, now],
    );
    sqlite.run(
      `INSERT INTO habit_entries (id, habit_id, date, status, created_at, updated_at)
       VALUES ('e1', 'h1', '2024-01-02', 'done', ?, ?)`,
      [now, now],
    );
    for (const entry of bundledMigrations.journal.entries.slice(1)) {
      await prepareDatabase(migrationAdapter(sqlite), bundleUpTo(entry.idx));
      expect(scalar(sqlite, 'SELECT count(*) FROM habit_entries')).toBe(1);
      expect(scalar(sqlite, 'SELECT name FROM habits')).toBe('Água');
    }
  });
});

describe('integrity', () => {
  it('enforces foreign keys', async () => {
    const { sqlite, db } = await openTestDatabase();
    expect(scalar(sqlite, 'PRAGMA foreign_keys')).toBe(1);
    const repos = createDrizzleRepositories(db);
    expect(
      await sqliteError(repos.entries.upsert('missing-habit', '2026-01-01', { status: 'done' })),
    ).toMatch(/FOREIGN KEY/);
  });

  it('never duplicates an entry for the same habit and day, even with concurrent taps', async () => {
    const { sqlite, db } = await openTestDatabase();
    const repos = createDrizzleRepositories(db);
    const habit = await repos.habits.create(draft());
    await Promise.all(
      Array.from({ length: 10 }, (_, n) =>
        repos.entries.upsert(habit.id, '2026-02-01', { status: n % 2 ? 'done' : 'skipped' }),
      ),
    );
    await repos.entries.remove(habit.id, '2026-02-01');
    await repos.entries.upsert(habit.id, '2026-02-01', { status: 'done' });
    expect(scalar(sqlite, 'SELECT count(*) FROM habit_entries')).toBe(1);
    // The constraint itself, not just the upsert, rejects a second row.
    expect(() =>
      sqlite.run(
        `INSERT INTO habit_entries (id, habit_id, date, status, created_at, updated_at)
         VALUES ('dup', ?, '2026-02-01', 'done', 'x', 'x')`,
        [habit.id],
      ),
    ).toThrow(/UNIQUE/);
  });

  it('saves a habit and its reminders atomically', async () => {
    const { sqlite, db } = await openTestDatabase();
    const repos = createDrizzleRepositories(db);
    const existing = await repos.habits.create(draft({ name: 'Antes', reminders: ['08:00'] }));
    // Make the reminder write fail after the habit row was written.
    sqlite.run(`CREATE TRIGGER fail_reminder BEFORE INSERT ON habit_reminders
      BEGIN SELECT RAISE(ABORT, 'disk full'); END`);

    expect(await sqliteError(repos.habits.create(draft({ name: 'Novo' })))).toBe('disk full');
    expect(
      await sqliteError(
        repos.habits.update(existing.id, draft({ name: 'Depois', reminders: ['09:00'] })),
      ),
    ).toBe('disk full');

    expect((await repos.habits.list()).map((h) => [h.name, h.reminders])).toEqual([
      ['Antes', ['08:00']],
    ]);
  });

  it('runs concurrent transactions one after the other', async () => {
    const { db } = await openTestDatabase();
    const repos = createDrizzleRepositories(db);
    const created = await Promise.all([
      repos.habits.create(draft({ name: 'A' })),
      repos.habits.create(draft({ name: 'B' })),
      repos.backup.importMerge({
        habits: [],
        habitReminders: [],
        habitEntries: [],
        tasks: [],
        events: [],
        dayNotes: [],
        goals: [],
        settings: [{ key: 'weekStartsOn', value: '1', updatedAt: '2026-01-01T00:00:00.000Z' }],
      }),
      repos.habits.create(draft({ name: 'C' })),
    ]);
    expect(created).toHaveLength(4);
    expect((await repos.habits.list()).map((h) => h.name).sort()).toEqual(['A', 'B', 'C']);
    await repos.habits.reorder([created[1].id, created[0].id]);
    expect(await repos.settings.get('weekStartsOn')).toBe(1);
  });

  it('rolls back a failed transaction completely', async () => {
    const { db } = await openTestDatabase();
    const repos = createDrizzleRepositories(db);
    const a = await repos.habits.create(draft({ name: 'A' }));
    const failing = db.transaction(async (tx) => {
      await tx.run(sql`UPDATE habits SET name = 'mudou' WHERE id = ${a.id}`);
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    expect((await repos.habits.getById(a.id))?.name).toBe('A');
  });
});
