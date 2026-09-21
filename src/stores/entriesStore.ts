import { useEffect, useState } from 'react';
import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import type { EntryInput, HabitEntry } from '@/core/habits/types';
import { getRepositories } from '@/repositories';

/** Entries of one day, keyed by habit id. */
export type DayEntries = Record<string, HabitEntry | undefined>;

interface EntriesState {
  byDate: Record<LocalDate, DayEntries | undefined>;
  /** Incremented after every change; range hooks refetch when it changes. */
  version: number;
  loadDate(date: LocalDate): Promise<void>;
  /**
   * Saves (or removes, with `null`) the entry of a habit on a day. Optimistic: the UI updates
   * immediately and rolls back if persisting fails.
   */
  save(habitId: string, date: LocalDate, next: EntryInput | null): Promise<void>;
  /** Drops cached data (after an import or "delete all"). */
  reset(): void;
}

const EMPTY: DayEntries = {};

export const useEntriesStore = create<EntriesState>()((set, get) => {
  const setEntry = (date: LocalDate, habitId: string, entry: HabitEntry | undefined) =>
    set((state) => ({
      byDate: { ...state.byDate, [date]: { ...state.byDate[date], [habitId]: entry } },
    }));

  return {
    byDate: {},
    version: 0,

    async loadDate(date) {
      const entries = await getRepositories().entries.listByDate(date);
      const day: DayEntries = {};
      for (const entry of entries) day[entry.habitId] = entry;
      set((state) => ({ byDate: { ...state.byDate, [date]: day } }));
    },

    async save(habitId, date, next) {
      const previous = get().byDate[date]?.[habitId];
      const { entries } = getRepositories();

      if (next === null) {
        setEntry(date, habitId, undefined);
      } else {
        const timestamp = new Date().toISOString();
        setEntry(date, habitId, {
          id: previous?.id ?? `pending-${habitId}-${date}`,
          habitId,
          date,
          status: next.status,
          value: next.value ?? null,
          note: next.note ?? null,
          createdAt: previous?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
      }

      try {
        if (next === null) {
          await entries.remove(habitId, date);
        } else {
          setEntry(date, habitId, await entries.upsert(habitId, date, next));
        }
        set((state) => ({ version: state.version + 1 }));
      } catch (error) {
        setEntry(date, habitId, previous);
        throw error;
      }
    },

    reset() {
      set((state) => ({ byDate: {}, version: state.version + 1 }));
    },
  };
});

export function selectDayEntries(date: LocalDate) {
  return (state: EntriesState): DayEntries => state.byDate[date] ?? EMPTY;
}

/**
 * Entries in an inclusive date range, refetched whenever entries change.
 * `null` while loading the first time.
 */
export function useEntriesInRange(from: LocalDate, to: LocalDate): HabitEntry[] | null {
  const version = useEntriesStore((state) => state.version);
  const [result, setResult] = useState<{ key: string; entries: HabitEntry[] } | null>(null);
  const key = `${from}|${to}`;

  useEffect(() => {
    let cancelled = false;
    getRepositories()
      .entries.listByRange(from, to)
      .then((entries) => {
        if (!cancelled) setResult({ key, entries });
      })
      .catch((error: unknown) => console.error('Failed to load entries', error));
    return () => {
      cancelled = true;
    };
  }, [from, to, key, version]);

  return result?.key === key ? result.entries : null;
}

/** Full history of one habit, refetched whenever entries change. */
export function useHabitHistory(habitId: string): HabitEntry[] | null {
  const version = useEntriesStore((state) => state.version);
  const [result, setResult] = useState<{ habitId: string; entries: HabitEntry[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepositories()
      .entries.listByHabit(habitId)
      .then((entries) => {
        if (!cancelled) setResult({ habitId, entries });
      })
      .catch((error: unknown) => console.error('Failed to load habit history', error));
    return () => {
      cancelled = true;
    };
  }, [habitId, version]);

  return result?.habitId === habitId ? result.entries : null;
}
