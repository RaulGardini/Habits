import { daysBetween, minDate } from '@/core/dates/periods';
import { toLocalDate, weekdayOf, type LocalDate } from '@/core/dates/localDate';
import { hasWeekday } from '@/core/dates/weekdays';

import type { Habit } from './types';

/**
 * Does the frequency put the habit on `date`? Ignores archiving (used for history/stats).
 * Flexible `per_period` habits are available every day; their quota is evaluated per period.
 */
export function isScheduledOn(habit: Habit, date: LocalDate): boolean {
  if (date < habit.startDate) return false;
  const frequency = habit.frequency;
  switch (frequency.type) {
    case 'daily':
    case 'per_period':
      return true;
    case 'weekdays':
      return hasWeekday(frequency.days, weekdayOf(date));
    case 'interval':
      return daysBetween(habit.startDate, date) % Math.max(1, frequency.every) === 0;
  }
}

/** Should the habit show up on `date` (Today screen)? Archived habits never do. */
export function isDueOn(habit: Habit, date: LocalDate): boolean {
  return habit.archivedAt === null && isScheduledOn(habit, date);
}

/** Habits due on `date`, in the user's order. */
export function habitsDueOn(habits: readonly Habit[], date: LocalDate): Habit[] {
  return habits.filter((habit) => isDueOn(habit, date)).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Last day that counts for the habit's history: today, or the archive day if archived. */
export function habitEndDate(habit: Habit, today: LocalDate): LocalDate {
  if (habit.archivedAt === null) return today;
  return minDate(today, toLocalDate(new Date(habit.archivedAt)));
}
