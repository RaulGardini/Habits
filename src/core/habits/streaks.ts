import { eachDay, nextPeriodStart, periodRange } from '@/core/dates/periods';
import type { LocalDate } from '@/core/dates/localDate';

import { periodTarget } from './quota';
import { habitEndDate, isScheduledOn } from './schedule';
import type { Habit, HabitEntry, WeekStartsOn } from './types';

export interface Streaks {
  current: number;
  longest: number;
  /** Day-based for daily/weekdays/interval habits; week/month for flexible habits. */
  unit: 'day' | 'week' | 'month';
}

/**
 * Streaks that respect the frequency:
 * - daily / weekdays / interval: counts consecutive *scheduled* days done. Unscheduled days
 *   (e.g. Tuesday for a Mon/Wed/Fri habit) and skipped days neither count nor break the streak.
 *   Today not being done yet does not break the current streak.
 * - per_period ("3x per week"): counts consecutive periods whose quota was met. The current
 *   period does not break the streak while it is in progress.
 */
export function computeStreaks(
  habit: Habit,
  habitEntries: readonly HabitEntry[],
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): Streaks {
  const byDate = new Map<LocalDate, HabitEntry>();
  for (const entry of habitEntries) if (entry.habitId === habit.id) byDate.set(entry.date, entry);
  const end = habitEndDate(habit, today);

  if (habit.frequency.type === 'per_period') {
    return periodStreaks(habit, byDate, end, today, weekStartsOn);
  }

  let run = 0;
  let longest = 0;
  for (const day of eachDay(habit.startDate, end)) {
    if (!isScheduledOn(habit, day)) continue;
    const status = byDate.get(day)?.status;
    if (status === 'done') {
      run += 1;
      longest = Math.max(longest, run);
    } else if (status === 'skipped' || day === today) {
      continue;
    } else {
      run = 0;
    }
  }
  return { current: run, longest, unit: 'day' };
}

function periodStreaks(
  habit: Habit,
  byDate: ReadonlyMap<LocalDate, HabitEntry>,
  end: LocalDate,
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): Streaks {
  if (habit.frequency.type !== 'per_period') throw new Error('Expected a per_period habit');
  const unit = habit.frequency.period;
  let run = 0;
  let longest = 0;

  for (
    let cursor = habit.startDate;
    cursor <= end;
    cursor = nextPeriodStart(cursor, unit, weekStartsOn)
  ) {
    const range = periodRange(cursor, unit, weekStartsOn);
    let done = 0;
    for (const [date, entry] of byDate) {
      if (
        entry.status === 'done' &&
        date >= range.from &&
        date <= range.to &&
        date >= habit.startDate
      ) {
        done += 1;
      }
    }
    if (done >= periodTarget(habit, range)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (range.to >= today) {
      // Current period still in progress.
      continue;
    } else {
      run = 0;
    }
  }
  return { current: run, longest, unit };
}
