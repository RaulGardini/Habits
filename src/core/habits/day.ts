import type { DayPeriod } from '@/core/dates/dayPeriod';

import { entryProgress } from './entries';
import { TIMES_OF_DAY, type Habit, type HabitEntry, type TimeOfDay } from './types';

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
  /** Habits fully done. */
  completed: number;
  /** Habits that count for the day (skipped / excluded ones are left out). */
  total: number;
  /** 0..1, partial quantity/timer progress included; 0 when there is nothing to do. */
  ratio: number;
}

/**
 * @param excluded habits that do not count today even if listed — e.g. a flexible
 *   "3x per week" habit whose weekly quota is already met and was not done today.
 */
export function computeDayProgress(
  dueHabits: readonly Habit[],
  entriesByHabitId: Readonly<Record<string, HabitEntry | undefined>>,
  excluded: ReadonlySet<string> = new Set(),
): DayProgress {
  let completed = 0;
  let total = 0;
  let progress = 0;
  for (const habit of dueHabits) {
    const entry = entriesByHabitId[habit.id];
    if (entry?.status === 'skipped') continue;
    if (excluded.has(habit.id) && entry?.status !== 'done') continue;
    total += 1;
    if (entry?.status === 'done') completed += 1;
    progress += entryProgress(habit, entry);
  }
  return { completed, total, ratio: total === 0 ? 0 : progress / total };
}

/** The day period to highlight: only when looking at today. */
export function highlightedPeriod(
  viewedDate: string,
  today: string,
  currentPeriod: DayPeriod,
): DayPeriod | null {
  return viewedDate === today ? currentPeriod : null;
}
