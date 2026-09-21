import type { LocalDate } from '@/core/dates/localDate';
import type { EntryStatus, Habit, HabitDraft, HabitEntry } from '@/core/habits/types';

/**
 * Data-access contracts. UI and stores depend on these interfaces only, never on Drizzle,
 * so the storage implementation can be swapped (e.g. a different driver on web).
 * All reads ignore soft-deleted rows.
 */
export interface HabitRepository {
  /** Active and archived habits, ordered by `sortOrder`. */
  list(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  /** Creates the habit at the end of the list. */
  create(draft: HabitDraft): Promise<Habit>;
  update(id: string, draft: HabitDraft): Promise<Habit>;
  setArchived(id: string, archived: boolean): Promise<Habit>;
  /** Soft delete. */
  remove(id: string): Promise<void>;
  /** Persists the given order (`sortOrder` = index). */
  reorder(orderedIds: readonly string[]): Promise<void>;
}

export interface EntryInput {
  status: EntryStatus;
  value?: number | null;
  note?: string | null;
}

export interface EntryRepository {
  listByDate(date: LocalDate): Promise<HabitEntry[]>;
  /** Inclusive range. */
  listByRange(from: LocalDate, to: LocalDate): Promise<HabitEntry[]>;
  /** Creates, updates or revives (if soft-deleted) the entry of a habit on a day. */
  upsert(habitId: string, date: LocalDate, input: EntryInput): Promise<HabitEntry>;
  /** Soft delete. No-op when there is no entry. */
  remove(habitId: string, date: LocalDate): Promise<void>;
}

export interface SettingsRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface Repositories {
  habits: HabitRepository;
  entries: EntryRepository;
  settings: SettingsRepository;
}
