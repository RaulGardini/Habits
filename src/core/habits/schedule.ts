import type { LocalDate } from '@/core/dates/localDate';

import type { Habit } from './types';

/** Does the habit need to be done on `date`? */
export function isDueOn(habit: Habit, date: LocalDate): boolean {
  if (habit.archivedAt !== null) return false;
  if (date < habit.startDate) return false;

  switch (habit.frequency.type) {
    case 'daily':
      return true;
  }
}

/** Habits due on `date`, in the user's order. */
export function habitsDueOn(habits: readonly Habit[], date: LocalDate): Habit[] {
  return habits.filter((habit) => isDueOn(habit, date)).sort((a, b) => a.sortOrder - b.sortOrder);
}
