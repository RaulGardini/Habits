import type { DayPeriod } from '@/core/dates/dayPeriod';

import {
  TIMES_OF_DAY,
  type EntryStatus,
  type Habit,
  type HabitEntry,
  type TimeOfDay,
} from './types';

export interface TimeOfDayGroup {
  timeOfDay: TimeOfDay;
  habits: Habit[];
}

/** Groups habits in display order (morning → afternoon → evening → anytime), skipping empty groups. */
export function groupByTimeOfDay(habits: readonly Habit[]): TimeOfDayGroup[] {
  return TIMES_OF_DAY.map((timeOfDay) => ({
    timeOfDay,
    habits: habits.filter((habit) => habit.timeOfDay === timeOfDay),
  })).filter((group) => group.habits.length > 0);
}

export interface DayProgress {
  completed: number;
  /** Habits that count for the day (skipped ones are excluded). */
  total: number;
  /** 0..1; 0 when there is nothing to do. */
  ratio: number;
}

export function computeDayProgress(
  dueHabits: readonly Habit[],
  entriesByHabitId: Readonly<Record<string, HabitEntry | undefined>>,
): DayProgress {
  let completed = 0;
  let total = 0;
  for (const habit of dueHabits) {
    const status = entriesByHabitId[habit.id]?.status;
    if (status === 'skipped') continue;
    total += 1;
    if (status === 'done') completed += 1;
  }
  return { completed, total, ratio: total === 0 ? 0 : completed / total };
}

/**
 * Status after tapping the check of a yes/no habit.
 * `null` means "no entry" (the entry should be removed).
 */
export function nextBooleanStatus(current: EntryStatus | undefined): EntryStatus | null {
  return current === 'done' ? null : 'done';
}

/** The day period to highlight: only when looking at today. */
export function highlightedPeriod(
  viewedDate: string,
  today: string,
  currentPeriod: DayPeriod,
): DayPeriod | null {
  return viewedDate === today ? currentPeriod : null;
}
