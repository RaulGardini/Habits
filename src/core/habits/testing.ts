import type { Habit, HabitEntry } from './types';

/** Test builders — only imported from `*.test.ts` files. */
export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Beber água',
    icon: 'cup-water',
    color: 'blue',
    timeOfDay: 'anytime',
    frequency: { type: 'daily' },
    tracking: { type: 'boolean' },
    startDate: '2026-01-01',
    archivedAt: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<HabitEntry> = {}): HabitEntry {
  return {
    id: 'entry-1',
    habitId: 'habit-1',
    date: '2026-09-21',
    status: 'done',
    value: null,
    note: null,
    createdAt: '2026-09-21T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
    ...overrides,
  };
}
