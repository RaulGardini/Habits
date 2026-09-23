import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Conventions (see CLAUDE.md):
 * - `id` is a UUID string.
 * - `created_at` / `updated_at` / `deleted_at` are ISO-8601 UTC strings; rows are soft-deleted.
 * - Calendar days are local `YYYY-MM-DD` strings, never timestamps.
 */
const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    timeOfDay: text('time_of_day', { enum: ['morning', 'afternoon', 'evening', 'anytime'] })
      .notNull()
      .default('anytime'),
    frequencyType: text('frequency_type', {
      enum: ['daily', 'weekdays', 'per_period', 'interval'],
    })
      .notNull()
      .default('daily'),
    /** Bitmask, Sunday = 1 << 0 … Saturday = 1 << 6. Used by `weekdays`. */
    frequencyWeekdays: integer('frequency_weekdays'),
    /** "X times per period". Used by `per_period`. */
    frequencyCount: integer('frequency_count'),
    frequencyPeriod: text('frequency_period', { enum: ['week', 'month'] }),
    /** "Every X days", counted from `start_date`. Used by `interval`. */
    frequencyInterval: integer('frequency_interval'),
    trackingType: text('tracking_type', { enum: ['boolean', 'quantity', 'timer'] })
      .notNull()
      .default('boolean'),
    /** Quantity target, or seconds for timer habits. */
    targetValue: real('target_value'),
    unit: text('unit'),
    /** Increment of the +/− buttons for quantity habits. */
    quantityStep: real('quantity_step'),
    startDate: text('start_date').notNull(),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Unused/reserved: goals link to habits through `goals.habit_id`. */
    goalId: text('goal_id'),
    ...timestamps,
  },
  (t) => [index('habits_sort_order_idx').on(t.sortOrder)],
);

export const habitEntries = sqliteTable(
  'habit_entries',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id),
    date: text('date').notNull(),
    status: text('status', { enum: ['done', 'partial', 'skipped', 'missed'] }).notNull(),
    value: real('value'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    // One row per habit per day. A soft-deleted row is revived instead of inserting a new one.
    uniqueIndex('habit_entries_habit_date_uq').on(t.habitId, t.date),
    index('habit_entries_date_idx').on(t.date),
  ],
);

export const habitReminders = sqliteTable(
  'habit_reminders',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id),
    /** Local time `HH:mm`. */
    time: text('time').notNull(),
    /** Optional weekday bitmask; null = every day the habit is due. */
    weekdays: integer('weekdays'),
    ...timestamps,
  },
  (t) => [index('habit_reminders_habit_idx').on(t.habitId)],
);

/** Key/value app settings (theme, first day of week…). Values are JSON-encoded. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** Day the task is planned for (local `YYYY-MM-DD`). */
    date: text('date').notNull(),
    priority: text('priority', { enum: ['low', 'normal', 'high'] })
      .notNull()
      .default('normal'),
    completedAt: text('completed_at'),
    /** Original day when the task was rolled over to a later day. */
    rolledFrom: text('rolled_from'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('tasks_date_idx').on(t.date)],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    date: text('date').notNull(),
    /** Local time `HH:mm`. */
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    /** Habit palette key. */
    color: text('color').notNull(),
    note: text('note'),
    /** 0/1. All-day events keep `start_time` = '00:00' and no end time. */
    allDay: integer('all_day').notNull().default(0),
    location: text('location'),
    repeat: text('repeat', { enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] })
      .notNull()
      .default('none'),
    /** Last local day of the series (inclusive), or null = forever. */
    repeatUntil: text('repeat_until'),
    /** Comma-separated local days removed from the series ("only this one" deletes). */
    excludedDates: text('excluded_dates').notNull().default(''),
    /** Minutes before the start (all-day: before 09:00), or null = no reminder. */
    reminderMinutes: integer('reminder_minutes'),
    ...timestamps,
  },
  (t) => [
    index('events_date_idx').on(t.date),
    // Recurring series that started before a range (see `EventRepository.listByRange`). The
    // query must use the same literal predicate for SQLite to pick this partial index.
    index('events_series_idx').on(t.date).where(sql.raw(`repeat <> 'none'`)),
  ],
);

export const dayNotes = sqliteTable(
  'day_notes',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    content: text('content').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('day_notes_date_uq').on(t.date)],
);

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    scope: text('scope', { enum: ['month', 'year'] }).notNull(),
    /** `YYYY-MM` for monthly goals, `YYYY` for yearly goals. */
    period: text('period').notNull(),
    target: real('target').notNull(),
    unit: text('unit'),
    /** Manual progress (ignored when linked to a habit). */
    current: real('current').notNull().default(0),
    /** When set, progress is computed from this habit's entries in the period. */
    habitId: text('habit_id'),
    ...timestamps,
  },
  (t) => [index('goals_scope_period_idx').on(t.scope, t.period)],
);

/**
 * Local changes not pushed to the cloud yet: one row per changed row, filled by SQLite triggers
 * in the same transaction as the change (migration 0005), so it survives the app being closed
 * and never depends on the device clock. `seq` grows with every change (a row changed again
 * gets a new `seq`), so a push only clears what it actually sent.
 */
export const syncOutbox = sqliteTable(
  'sync_outbox',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    /** Backup table name (`habitEntries`…). */
    tableName: text('table_name').notNull(),
    /** `id`, or `key` for settings. */
    rowKey: text('row_key').notNull(),
  },
  (t) => [uniqueIndex('sync_outbox_row_uq').on(t.tableName, t.rowKey)],
);

/** While it has a row, the outbox triggers are off (applying rows pulled from the cloud). */
export const syncPause = sqliteTable('sync_pause', {
  id: integer('id').primaryKey(),
});

export type HabitRow = typeof habits.$inferSelect;
export type HabitEntryRow = typeof habitEntries.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type DayNoteRow = typeof dayNotes.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
