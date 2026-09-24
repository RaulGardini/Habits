import { useEffect, useState } from 'react';
import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import type { EntryInput, HabitEntry } from '@/core/habits/types';
import { getRepositories } from '@/repositories';
import { useAsyncError } from '@/lib/useAsyncError';

/** Entries of one day, keyed by habit id. */
export type DayEntries = Record<string, HabitEntry | undefined>;

interface EntriesState {
  byDate: Record<LocalDate, DayEntries | undefined>;
  /**
   * Loaded date ranges (`from|to` → entries ordered by date), shared by every screen that asks
   * for the same range. Kept up to date in memory on each save, so a check never refetches
   * years of history; dropped by `reset()`.
   */
  ranges: Record<string, HabitEntry[] | undefined>;
  /** Incremented after every change (sync, widgets and per-habit history listen to it). */
  version: number;
  loadDate(date: LocalDate): Promise<void>;
  loadRange(from: LocalDate, to: LocalDate): Promise<void>;
  /**
   * Saves (or removes, with `null`) the entry of a habit on a day. Optimistic: the UI updates
   * immediately and rolls back if persisting fails.
   */
  save(habitId: string, date: LocalDate, next: EntryInput | null): Promise<void>;
  /** Drops cached data (after an import, a sync pull or "delete all"). */
  reset(): void;
}

const EMPTY: DayEntries = {};
/** Ranges kept in memory (the oldest loaded is dropped first). */
const MAX_RANGES = 12;

const rangeKey = (from: LocalDate, to: LocalDate) => `${from}|${to}`;

/** Saves in flight per `habitId|date`: the newest tap wins on screen and in the database. */
const pendingSaves = new Map<
  string,
  { latest: number; confirmed: HabitEntry | undefined; count: number }
>();
let saveSeq = 0;

/** Loads in flight, so concurrent requests for the same data share one query. */
const inflightRanges = new Map<string, Promise<void>>();
const inflightDays = new Map<LocalDate, Promise<void>>();

/** `entries` with the entry of (habitId, date) replaced (or removed with `undefined`). */
function patchRange(
  entries: HabitEntry[],
  habitId: string,
  date: LocalDate,
  entry: HabitEntry | undefined,
): HabitEntry[] {
  const kept = entries.filter((e) => !(e.habitId === habitId && e.date === date));
  if (!entry) return kept;
  const index = kept.findIndex((e) => e.date > date);
  kept.splice(index === -1 ? kept.length : index, 0, entry);
  return kept;
}

export const useEntriesStore = create<EntriesState>()((set, get) => {
  /** Updates the day cache and every loaded range containing that day. */
  const setEntry = (date: LocalDate, habitId: string, entry: HabitEntry | undefined) =>
    set((state) => {
      const ranges = { ...state.ranges };
      for (const [key, entries] of Object.entries(state.ranges)) {
        const [from = '', to = ''] = key.split('|');
        if (entries && date >= from && date <= to) {
          ranges[key] = patchRange(entries, habitId, date, entry);
        }
      }
      return {
        byDate: { ...state.byDate, [date]: { ...state.byDate[date], [habitId]: entry } },
        ranges,
      };
    });

  return {
    byDate: {},
    ranges: {},
    version: 0,

    loadDate(date) {
      const pending = inflightDays.get(date);
      if (pending) return pending;
      const version = get().version;
      const load = (async () => {
        const entries = await getRepositories().entries.listByDate(date);
        // A save or reset happened meanwhile: this result may be stale, load again.
        if (get().version !== version) {
          inflightDays.delete(date);
          return get().loadDate(date);
        }
        const day: DayEntries = {};
        for (const entry of entries) day[entry.habitId] = entry;
        set((state) => ({ byDate: { ...state.byDate, [date]: day } }));
      })().finally(() => {
        if (inflightDays.get(date) === load) inflightDays.delete(date);
      });
      inflightDays.set(date, load);
      return load;
    },

    loadRange(from, to) {
      const key = rangeKey(from, to);
      const pending = inflightRanges.get(key);
      if (pending) return pending;
      const load = (async () => {
        // The database handles one query at a time: let the day on screen load first instead
        // of queueing it behind a history of tens of thousands of rows.
        await Promise.allSettled([...inflightDays.values()]);
        const version = get().version;
        const entries = await getRepositories().entries.listByRange(from, to);
        // A save or reset happened meanwhile: this result may be stale, load again.
        if (get().version !== version) {
          inflightRanges.delete(key);
          return get().loadRange(from, to);
        }
        set((state) => {
          const ranges = { ...state.ranges, [key]: entries };
          const keys = Object.keys(ranges);
          for (const old of keys.slice(0, Math.max(0, keys.length - MAX_RANGES))) {
            delete ranges[old];
          }
          return { ranges };
        });
      })().finally(() => {
        if (inflightRanges.get(key) === load) inflightRanges.delete(key);
      });
      inflightRanges.set(key, load);
      return load;
    },

    async save(habitId, date, next) {
      const key = `${habitId}|${date}`;
      const previous = get().byDate[date]?.[habitId];
      const { entries } = getRepositories();
      const seq = ++saveSeq;
      let pending = pendingSaves.get(key);
      if (!pending) {
        // What the database holds before this burst of taps (for rollbacks).
        pending = { latest: seq, confirmed: previous, count: 0 };
        pendingSaves.set(key, pending);
      }
      pending.latest = seq;
      pending.count += 1;

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
        // Writes run in the order they were issued (one database queue), so the last tap is
        // the one that ends up stored.
        const saved = next === null ? undefined : await entries.upsert(habitId, date, next);
        if (next === null) await entries.remove(habitId, date);
        pending.confirmed = saved;
        // An older write finishing late must not overwrite what a newer tap shows.
        if (pending.latest === seq) setEntry(date, habitId, saved);
        set((state) => ({ version: state.version + 1 }));
      } catch (error) {
        if (pending.latest === seq) setEntry(date, habitId, pending.confirmed);
        throw error;
      } finally {
        pending.count -= 1;
        if (pending.count === 0) pendingSaves.delete(key);
      }
    },

    reset() {
      set((state) => ({ byDate: {}, ranges: {}, version: state.version + 1 }));
    },
  };
});

export function selectDayEntries(date: LocalDate) {
  return (state: EntriesState): DayEntries => state.byDate[date] ?? EMPTY;
}

/**
 * Entries of a day, loaded on demand — and reloaded whenever the cache is cleared (after an
 * import, or a check made from a home screen widget). A failure goes to the screen's error boundary.
 */
export function useDayEntries(date: LocalDate): { entries: DayEntries; loaded: boolean } {
  const day = useEntriesStore((state) => state.byDate[date]);
  const loadDate = useEntriesStore((state) => state.loadDate);
  const fail = useAsyncError('Failed to load entries');
  const loaded = day !== undefined;
  useEffect(() => {
    if (!loaded) loadDate(date).catch(fail);
  }, [date, loaded, loadDate, fail]);
  return { entries: day ?? EMPTY, loaded };
}

/**
 * Entries in an inclusive date range (ordered by date), shared between screens and kept in
 * sync with saves. `null` while loading the first time; a failure goes to the screen's error
 * boundary.
 */
export function useEntriesInRange(from: LocalDate, to: LocalDate): HabitEntry[] | null {
  const entries = useEntriesStore((state) => state.ranges[rangeKey(from, to)]);
  const loadRange = useEntriesStore((state) => state.loadRange);
  const fail = useAsyncError('Failed to load entries');
  const loaded = entries !== undefined;
  useEffect(() => {
    if (!loaded) loadRange(from, to).catch(fail);
  }, [from, to, loaded, loadRange, fail]);
  return entries ?? null;
}

/** Full history of one habit, refetched whenever entries change. */
export function useHabitHistory(habitId: string): HabitEntry[] | null {
  const version = useEntriesStore((state) => state.version);
  const [result, setResult] = useState<{ habitId: string; entries: HabitEntry[] } | null>(null);
  const fail = useAsyncError('Failed to load habit history');

  useEffect(() => {
    let cancelled = false;
    getRepositories()
      .entries.listByHabit(habitId)
      .then((entries) => {
        if (!cancelled) setResult({ habitId, entries });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
  }, [habitId, version, fail]);

  return result?.habitId === habitId ? result.entries : null;
}
