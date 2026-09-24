import { todayLocal } from '@/core/dates/localDate';
import type { HabitDraft } from '@/core/habits/types';
import { syncReminders } from '@/lib/notifications';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { useHabitsStore } from './habitsStore';
import { rescheduleReminders } from './reminders';

jest.mock('@/lib/notifications', () => ({ syncReminders: jest.fn(async () => undefined) }));

const draft: HabitDraft = {
  name: 'Ler',
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-01-01',
  reminders: ['21:00'],
};

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  jest.mocked(syncReminders).mockClear();
});

it('plans from the database, so the widget task can call it with empty stores', async () => {
  const habit = await getRepositories().habits.create(draft);
  expect(useHabitsStore.getState().habits).toEqual([]); // nothing loaded, like a headless task
  await rescheduleReminders();
  const [habits, , settled] = jest.mocked(syncReminders).mock.calls[0]!;
  expect(habits.map((h) => h.id)).toEqual([habit.id]);
  expect(settled?.size).toBe(0);
});

it('stops the rest of today for habits checked today', async () => {
  const read = await getRepositories().habits.create(draft);
  const walk = await getRepositories().habits.create({ ...draft, name: 'Caminhar' });
  await getRepositories().entries.upsert(read.id, todayLocal(), { status: 'done', value: null });
  await rescheduleReminders();
  const [, , settled] = jest.mocked(syncReminders).mock.calls[0]!;
  expect([...(settled ?? [])]).toEqual([read.id]);
  expect(settled?.has(walk.id)).toBe(false);
});
