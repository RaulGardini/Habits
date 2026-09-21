import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import { entryWithValue } from '@/core/habits/entries';
import type { Habit } from '@/core/habits/types';
import { getRepositories } from '@/repositories';

import { useEntriesStore } from './entriesStore';
import { useHabitsStore } from './habitsStore';

const ACTIVE_TIMER_KEY = 'activeTimer';

export interface ActiveTimer {
  habitId: string;
  date: LocalDate;
  /** Epoch ms when the timer was (re)started. */
  startedAt: number;
  /** Seconds already recorded before this run. */
  baseSeconds: number;
}

interface TimerState {
  /** At most one timer runs at a time. Persisted so it survives app restarts. */
  active: ActiveTimer | null;
  load(): Promise<void>;
  start(habit: Habit, date: LocalDate): Promise<void>;
  /** Stops the running timer and saves the elapsed time to the entry. */
  stop(): Promise<void>;
  /** Forgets the running timer without saving (e.g. habit deleted, data wiped). */
  clear(): Promise<void>;
}

export function elapsedSeconds(timer: ActiveTimer, now: number): number {
  return timer.baseSeconds + Math.max(0, Math.floor((now - timer.startedAt) / 1000));
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  active: null,

  async load() {
    const active = await getRepositories().settings.get<ActiveTimer | null>(ACTIVE_TIMER_KEY);
    set({ active: active ?? null });
  },

  async start(habit, date) {
    const current = get().active;
    if (current) await get().stop();
    const entry = useEntriesStore.getState().byDate[date]?.[habit.id];
    const active: ActiveTimer = {
      habitId: habit.id,
      date,
      startedAt: Date.now(),
      baseSeconds: entry?.value ?? 0,
    };
    set({ active });
    await getRepositories().settings.set(ACTIVE_TIMER_KEY, active);
  },

  async stop() {
    const active = get().active;
    if (!active) return;
    set({ active: null });
    await getRepositories().settings.set(ACTIVE_TIMER_KEY, null);
    const habit = useHabitsStore.getState().habits.find((h) => h.id === active.habitId);
    if (!habit) return;
    const entries = useEntriesStore.getState();
    const entry = entries.byDate[active.date]?.[habit.id];
    await entries.save(
      habit.id,
      active.date,
      entryWithValue(habit, entry, elapsedSeconds(active, Date.now())),
    );
  },

  async clear() {
    set({ active: null });
    await getRepositories().settings.set(ACTIVE_TIMER_KEY, null);
  },
}));
