import { daysBetween, maxDate, periodRange, type DateRange } from '@/core/dates/periods';
import type { LocalDate } from '@/core/dates/localDate';

import type { Habit, HabitEntry, PeriodUnit, WeekStartsOn } from './types';

export interface PeriodQuota {
  unit: PeriodUnit;
  range: DateRange;
  /** Days marked done within the period. */
  done: number;
  /** Required count (reduced when the habit starts mid-period). */
  target: number;
  met: boolean;
}

/**
 * Target for a flexible habit in a period. When the habit starts in the middle of the period,
 * the target is capped by the number of days left (e.g. 3x/week starting on Saturday → 1).
 */
export function periodTarget(habit: Habit, range: DateRange): number {
  if (habit.frequency.type !== 'per_period') return 0;
  const from = maxDate(range.from, habit.startDate);
  const availableDays = daysBetween(from, range.to) + 1;
  return Math.max(0, Math.min(habit.frequency.count, availableDays));
}

/** Progress of a `per_period` habit in the period containing `date`. */
export function periodQuota(
  habit: Habit,
  date: LocalDate,
  habitEntries: readonly HabitEntry[],
  weekStartsOn: WeekStartsOn,
): PeriodQuota | null {
  if (habit.frequency.type !== 'per_period') return null;
  const range = periodRange(date, habit.frequency.period, weekStartsOn);
  const done = habitEntries.filter(
    (e) =>
      e.habitId === habit.id &&
      e.status === 'done' &&
      e.date >= range.from &&
      e.date <= range.to &&
      e.date >= habit.startDate,
  ).length;
  const target = periodTarget(habit, range);
  return { unit: habit.frequency.period, range, done, target, met: done >= target };
}
