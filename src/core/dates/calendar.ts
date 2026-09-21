import type { WeekStartsOn } from '@/core/habits/types';

import { addDaysLocal, type LocalDate } from './localDate';
import { periodRange } from './periods';

/**
 * Days of `from..to` laid out in whole weeks (each inner array is one week of 7 slots, in
 * display order). Slots outside the range are `null`. Used by the month calendar (weeks as
 * rows) and the year heatmap (weeks as columns).
 */
export function weeksGrid(
  from: LocalDate,
  to: LocalDate,
  weekStartsOn: WeekStartsOn,
): (LocalDate | null)[][] {
  const weeks: (LocalDate | null)[][] = [];
  let cursor = periodRange(from, 'week', weekStartsOn).from;
  while (cursor <= to) {
    const week: (LocalDate | null)[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor >= from && cursor <= to ? cursor : null);
      cursor = addDaysLocal(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
