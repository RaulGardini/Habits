import { useMemo } from 'react';

import { addDaysLocal, type LocalDate } from '@/core/dates/localDate';
import { perfectStreak, type PerfectStreak } from '@/core/habits/perfectStreak';
import { overallDailyScores } from '@/core/stats/stats';
import { useFullHistory } from '@/features/habits/useStreaks';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** How far back the streak is looked up (enough for the last flame tiers). */
const HORIZON_DAYS = 1200;

/** Streak of perfect days ending today (see `perfectStreak`). */
export function usePerfectStreak(today: LocalDate): PerfectStreak {
  const habits = useHabitsStore((state) => state.habits);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const { from: earliest, entries } = useFullHistory(today);
  const horizon = addDaysLocal(today, -HORIZON_DAYS);
  const from = earliest < horizon ? horizon : earliest;

  return useMemo(() => {
    if (!entries) return { current: 0, longest: 0, startedOn: null };
    const scores = overallDailyScores(habits, entries, { from, to: today }, today, weekStartsOn);
    return perfectStreak(scores, from, today);
  }, [entries, habits, from, today, weekStartsOn]);
}
