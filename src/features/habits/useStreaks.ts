import { useMemo } from 'react';

import { computeStreaks, type Streaks } from '@/core/habits/streaks';
import type { Habit } from '@/core/habits/types';
import { useToday } from '@/hooks/useNow';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** Streaks of every habit (full history loaded once, refreshed on changes). */
export function useStreaks(habits: readonly Habit[]): Map<string, Streaks> {
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const earliest = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), today);
  const entries = useEntriesInRange(earliest, today);
  return useMemo(() => {
    const map = new Map<string, Streaks>();
    if (!entries) return map;
    for (const habit of habits) {
      const own = entries.filter((e) => e.habitId === habit.id);
      map.set(habit.id, computeStreaks(habit, own, today, weekStartsOn));
    }
    return map;
  }, [habits, entries, today, weekStartsOn]);
}
