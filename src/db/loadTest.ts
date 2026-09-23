import { count, getTableColumns } from 'drizzle-orm';

import { BACKUP_TABLES } from '@/core/backup/backup';
import { todayLocal } from '@/core/dates/localDate';

import type { Database } from './client';
import * as schema from './schema';
import { generateSeedData } from './seed';

const TABLES = {
  habits: schema.habits,
  habitReminders: schema.habitReminders,
  habitEntries: schema.habitEntries,
  tasks: schema.tasks,
  events: schema.events,
  dayNotes: schema.dayNotes,
  goals: schema.goals,
  settings: schema.settings,
} as const;

/** Inserts seed rows in bulk (500 per statement, one transaction). */
export async function insertSeedData(
  db: Database,
  data: ReturnType<typeof generateSeedData>,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const name of BACKUP_TABLES) {
      const table = TABLES[name];
      const columns = Object.keys(getTableColumns(table));
      const rows = data[name].map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column] ?? null])),
      );
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(table).values(rows.slice(i, i + 500) as never);
      }
    }
  });
}

/** Fills the dev load-test database once (see `loadTestDatabaseName`). */
export async function seedLoadTestDatabase(db: Database): Promise<void> {
  const [row] = await db.select({ value: count() }).from(schema.habits);
  if ((row?.value ?? 0) > 0) return;
  const started = performance.now();
  await insertSeedData(db, generateSeedData({ today: todayLocal() }));
  console.log(`Load test database seeded in ${Math.round(performance.now() - started)} ms`);
}
