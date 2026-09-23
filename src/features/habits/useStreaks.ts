import { useMemo } from 'react';

import type { LocalDate } from '@/core/dates/localDate';
import { computeStreaks, type Streaks } from '@/core/habits/streaks';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { useToday } from '@/hooks/useNow';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Every entry from the first habit's start until today. Always the same range for every
 * caller (streaks, perfect-day streak, on Today and Stats), so it is loaded once and then kept
 * in sync in memory by the entries store.
 */
export function useFullHistory(today: LocalDate): {
  from: LocalDate;
  entries: HabitEntry[] | null;
} {
  const habits = useHabitsStore((state) => state.habits);
  const from = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), today);
  return { from, entries: useEntriesInRange(from, today) };
}

/** Streaks of every habit (full history loaded once, refreshed on changes). */
export function useStreaks(habits: readonly Habit[]): Map<string, Streaks> {
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const { entries } = useFullHistory(today);
  return useMemo(() => {
    const map = new Map<string, Streaks>();
    if (!entries) return map;
    const byHabit = new Map<string, HabitEntry[]>();
    for (const entry of entries) {
      const own = byHabit.get(entry.habitId);
      if (own) own.push(entry);
      else byHabit.set(entry.habitId, [entry]);
    }
    for (const habit of habits) {
      map.set(habit.id, computeStreaks(habit, byHabit.get(habit.id) ?? [], today, weekStartsOn));
    }
    return map;
  }, [habits, entries, today, weekStartsOn]);
}
