import type { HabitDraft } from '@/core/habits/types';
import { createTestDatabase } from '@/db/testing';
import { createDrizzleRepositories } from '@/repositories/drizzle';

import { cloudSnapshot, restoreRows } from '@/core/backup/cloudBackup';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

const draft = (name: string): HabitDraft => ({
  name,
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
});

const later = () => new Promise((resolve) => setTimeout(resolve, 5));

it('restoring a snapshot brings back edited and deleted items, keeping newer ones', async () => {
  const repos = createDrizzleRepositories(await createTestDatabase());
  const read = await repos.habits.create(draft('Ler'));
  const run = await repos.habits.create(draft('Correr'));
  const snapshot = cloudSnapshot(await repos.backup.exportAll(), new Date());

  await later();
  await repos.habits.update(read.id, draft('Ler (editado)'));
  await repos.habits.remove(run.id);
  await repos.habits.create(draft('Meditar'));

  await later();
  await repos.backup.importMerge(restoreRows(snapshot.tables, new Date().toISOString()));

  const names = (await repos.habits.list()).map((h) => h.name).sort();
  expect(names).toEqual(['Correr', 'Ler', 'Meditar']);
});
