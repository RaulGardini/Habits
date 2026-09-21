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
    startDate: text('start_date').notNull(),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull().default(0),
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

export type HabitRow = typeof habits.$inferSelect;
export type HabitEntryRow = typeof habitEntries.$inferSelect;
