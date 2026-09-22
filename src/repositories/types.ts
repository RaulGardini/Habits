import type { BackupRow, BackupTable, ImportSummary } from '@/core/backup/backup';
import type { LocalDate } from '@/core/dates/localDate';
import type { EntryInput, Habit, HabitDraft, HabitEntry } from '@/core/habits/types';

import type {
  DayNote,
  EventDraft,
  Goal,
  GoalDraft,
  GoalScope,
  PlannerEvent,
  Task,
  TaskDraft,
} from '@/core/planner/types';

export type { EntryInput };

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

export interface EntryRepository {
  listByDate(date: LocalDate): Promise<HabitEntry[]>;
  /** Inclusive range, ordered by date. */
  listByRange(from: LocalDate, to: LocalDate): Promise<HabitEntry[]>;
  /** Full history of one habit, ordered by date. */
  listByHabit(habitId: string): Promise<HabitEntry[]>;
  /** Creates, updates or revives (if soft-deleted) the entry of a habit on a day. */
  upsert(habitId: string, date: LocalDate, input: EntryInput): Promise<HabitEntry>;
  /** Soft delete. No-op when there is no entry. */
  remove(habitId: string, date: LocalDate): Promise<void>;
}

export interface SettingsRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface TaskRepository {
  /** Inclusive range, any order. */
  listByRange(from: LocalDate, to: LocalDate): Promise<Task[]>;
  /** Pending tasks planned before `date`. */
  listOverdue(date: LocalDate): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  create(draft: TaskDraft): Promise<Task>;
  update(id: string, draft: TaskDraft): Promise<Task>;
  setCompleted(id: string, completed: boolean): Promise<void>;
  /** Moves tasks to another day, remembering the original day in `rolledFrom`. */
  moveToDate(ids: readonly string[], date: LocalDate): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface EventRepository {
  listByRange(from: LocalDate, to: LocalDate): Promise<PlannerEvent[]>;
  getById(id: string): Promise<PlannerEvent | null>;
  create(draft: EventDraft): Promise<PlannerEvent>;
  update(id: string, draft: EventDraft): Promise<PlannerEvent>;
  remove(id: string): Promise<void>;
}

export interface DayNoteRepository {
  get(date: LocalDate): Promise<DayNote | null>;
  /** Saves the note of a day; an empty text deletes it. */
  save(date: LocalDate, content: string): Promise<void>;
}

export interface GoalRepository {
  listByPeriod(scope: GoalScope, period: string): Promise<Goal[]>;
  getById(id: string): Promise<Goal | null>;
  create(draft: GoalDraft): Promise<Goal>;
  update(id: string, draft: GoalDraft): Promise<Goal>;
  setCurrent(id: string, current: number): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface BackupRepository {
  /** Every row of every table, including soft-deleted rows. */
  exportAll(): Promise<Record<BackupTable, BackupRow[]>>;
  /** Rows (incl. soft-deleted) with `updatedAt` after `since` — or every row when null. */
  exportChangedSince(since: string | null): Promise<Record<BackupTable, BackupRow[]>>;
  /** Merges a backup into the database (last write wins by `updatedAt`). */
  importMerge(tables: Record<BackupTable, BackupRow[]>): Promise<ImportSummary>;
  /** Permanently deletes all data (user-initiated "delete all data"). */
  deleteAll(): Promise<void>;
}

export interface Repositories {
  habits: HabitRepository;
  entries: EntryRepository;
  settings: SettingsRepository;
  tasks: TaskRepository;
  events: EventRepository;
  dayNotes: DayNoteRepository;
  goals: GoalRepository;
  backup: BackupRepository;
}
