import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import { nextBooleanStatus } from '@/core/habits/day';
import type { HabitEntry } from '@/core/habits/types';
import { getRepositories } from '@/repositories';

/** Entries of one day, keyed by habit id. */
export type DayEntries = Record<string, HabitEntry | undefined>;

interface EntriesState {
  byDate: Record<LocalDate, DayEntries | undefined>;
  loadDate(date: LocalDate): Promise<void>;
  /** Toggles a yes/no habit between done and not done. */
  toggle(habitId: string, date: LocalDate): Promise<void>;
}

const EMPTY: DayEntries = {};

export const useEntriesStore = create<EntriesState>()((set, get) => {
  const setEntry = (date: LocalDate, habitId: string, entry: HabitEntry | undefined) =>
    set((state) => ({
      byDate: { ...state.byDate, [date]: { ...state.byDate[date], [habitId]: entry } },
    }));

  return {
    byDate: {},

    async loadDate(date) {
      const entries = await getRepositories().entries.listByDate(date);
      const day: DayEntries = {};
      for (const entry of entries) day[entry.habitId] = entry;
      set((state) => ({ byDate: { ...state.byDate, [date]: day } }));
    },

    async toggle(habitId, date) {
      const previous = get().byDate[date]?.[habitId];
      const nextStatus = nextBooleanStatus(previous?.status);
      const { entries } = getRepositories();

      // Optimistic update so the check feels instant; rolled back on failure.
      if (nextStatus === null) {
        setEntry(date, habitId, undefined);
      } else {
        const timestamp = new Date().toISOString();
        setEntry(date, habitId, {
          id: previous?.id ?? `pending-${habitId}-${date}`,
          habitId,
          date,
          status: nextStatus,
          value: null,
          note: previous?.note ?? null,
          createdAt: previous?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
      }

      try {
        if (nextStatus === null) {
          await entries.remove(habitId, date);
        } else {
          setEntry(date, habitId, await entries.upsert(habitId, date, { status: nextStatus }));
        }
      } catch (error) {
        setEntry(date, habitId, previous);
        throw error;
      }
    },
  };
});

export function selectDayEntries(date: LocalDate) {
  return (state: EntriesState): DayEntries => state.byDate[date] ?? EMPTY;
}
