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
  /**
   * Starts the habit's timer on `date`, or stops it if it is the one running. Decided when it
   * runs (not when tapped), so two quick taps start and stop instead of restarting.
   */
  toggle(habit: Habit, date: LocalDate): Promise<void>;
  /** Forgets the running timer without saving (e.g. habit deleted, data wiped). */
  clear(): Promise<void>;
}

export function elapsedSeconds(timer: ActiveTimer, now: number): number {
  return timer.baseSeconds + Math.max(0, Math.floor((now - timer.startedAt) / 1000));
}

export const useTimerStore = create<TimerState>()((set, get) => {
  // Timer operations run one at a time: a start racing a stop could otherwise save 0 s over the
  // entry or leave two runs recorded.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  };

  async function start(habit: Habit, date: LocalDate) {
    if (get().active) await stop();
    const entry = useEntriesStore.getState().byDate[date]?.[habit.id];
    const active: ActiveTimer = {
      habitId: habit.id,
      date,
      startedAt: Date.now(),
      baseSeconds: entry?.value ?? 0,
    };
    set({ active });
    await getRepositories().settings.set(ACTIVE_TIMER_KEY, active);
  }

  async function stop() {
    const active = get().active;
    if (!active) return;
    set({ active: null });
    // The time is saved before the timer is forgotten: if the app dies in between, the timer
    // is still running on the next start (the entry holds a total, so nothing is counted twice)
    // instead of the elapsed time being lost.
    const habit = useHabitsStore.getState().habits.find((h) => h.id === active.habitId);
    if (habit) {
      const entries = useEntriesStore.getState();
      const entry = entries.byDate[active.date]?.[habit.id];
      try {
        await entries.save(
          habit.id,
          active.date,
          entryWithValue(habit, entry, elapsedSeconds(active, Date.now())),
        );
      } catch (error) {
        set({ active });
        throw error;
      }
    }
    await getRepositories().settings.set(ACTIVE_TIMER_KEY, null);
  }

  return {
    active: null,

    load: () =>
      serial(async () => {
        const active = await getRepositories().settings.get<ActiveTimer | null>(ACTIVE_TIMER_KEY);
        set({ active: active ?? null });
      }),

    start: (habit, date) => serial(() => start(habit, date)),

    stop: () => serial(stop),

    toggle: (habit, date) =>
      serial(async () => {
        const active = get().active;
        if (active?.habitId === habit.id && active.date === date) await stop();
        else await start(habit, date);
      }),

    clear: () =>
      serial(async () => {
        set({ active: null });
        await getRepositories().settings.set(ACTIVE_TIMER_KEY, null);
      }),
  };
});
