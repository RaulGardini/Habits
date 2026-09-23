import { addDaysLocal, type LocalDate } from '@/core/dates/localDate';
import type { DayScore } from '@/core/stats/stats';

/**
 * Streak of perfect days: every habit due on the day was completed. Days where nothing was due
 * are neutral (they neither count nor break the streak), and today only counts once it is
 * finished — an unfinished today never breaks the streak.
 */
export interface PerfectStreak {
  current: number;
  longest: number;
  /** Last day that counted, for "começou em…". */
  startedOn: LocalDate | null;
}

/** Flame tiers: each threshold changes the flame's color and name. */
export const FLAME_TIERS = [0, 5, 10, 30, 50, 100, 200, 300, 500, 1000] as const;

export type FlameTier = (typeof FLAME_TIERS)[number];

/** Index in `FLAME_TIERS` reached by a streak (0 = the first, smallest flame). */
export function flameTierIndex(days: number): number {
  let index = 0;
  for (let i = 0; i < FLAME_TIERS.length; i++) {
    if (days >= (FLAME_TIERS[i] ?? 0)) index = i;
  }
  return index;
}

/** Days still needed for the next tier, or null when the last one is reached. */
export function daysToNextTier(days: number): { threshold: number; remaining: number } | null {
  const next = FLAME_TIERS.find((threshold) => threshold > days);
  return next === undefined ? null : { threshold: next, remaining: next - days };
}

/** Progress (0..1) inside the current tier, for the ladder bar. */
export function tierProgress(days: number): number {
  const next = daysToNextTier(days);
  if (!next) return 1;
  const current = FLAME_TIERS[flameTierIndex(days)] ?? 0;
  const span = next.threshold - current;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (days - current) / span));
}

const isPerfect = (score: DayScore | null | undefined) =>
  score !== null && score !== undefined && score.total > 0 && score.completed === score.total;

/**
 * Computes the streak from per-day scores (see `overallDailyScores`), walking back from `today`.
 * `from` bounds how far back the scores go.
 */
export function perfectStreak(
  scores: ReadonlyMap<LocalDate, DayScore | null>,
  from: LocalDate,
  today: LocalDate,
): PerfectStreak {
  let current = 0;
  let startedOn: LocalDate | null = null;
  for (let date = today; date >= from; date = addDaysLocal(date, -1)) {
    const score = scores.get(date);
    if (isPerfect(score)) {
      current += 1;
      startedOn = date;
      continue;
    }
    // Nothing due (or today still in progress): neutral, keep walking back.
    if (score === null || score === undefined || date === today) continue;
    break;
  }

  let longest = 0;
  let run = 0;
  for (let date = from; date <= today; date = addDaysLocal(date, 1)) {
    const score = scores.get(date);
    if (isPerfect(score)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (score !== null && score !== undefined) {
      run = 0;
    }
  }

  return { current, longest: Math.max(longest, current), startedOn };
}
