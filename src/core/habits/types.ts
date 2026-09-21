import type { LocalDate } from '@/core/dates/localDate';

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export type PeriodUnit = 'week' | 'month';

/** 0 = Sunday, 1 = Monday. */
export type WeekStartsOn = 0 | 1;

export type Frequency =
  | { type: 'daily' }
  /** Specific weekdays. `days` is a bitmask: Sunday = 1 << 0 … Saturday = 1 << 6. */
  | { type: 'weekdays'; days: number }
  /** X times per week/month, on any days. */
  | { type: 'per_period'; count: number; period: PeriodUnit }
  /** Every X days, counted from the start date. */
  | { type: 'interval'; every: number };

export type FrequencyType = Frequency['type'];

export type Tracking =
  | { type: 'boolean' }
  /** e.g. 2 L of water, tapping +step each time. */
  | { type: 'quantity'; target: number; unit: string; step: number }
  | { type: 'timer'; targetSeconds: number };

export type TrackingType = Tracking['type'];

export const ENTRY_STATUSES = ['done', 'partial', 'skipped', 'missed'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface Habit {
  id: string;
  name: string;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  /** Key of the habit color palette (see `src/theme/habitColors.ts`). */
  color: string;
  timeOfDay: TimeOfDay;
  frequency: Frequency;
  tracking: Tracking;
  startDate: LocalDate;
  /** Reminder times `HH:mm`, sorted. */
  reminders: string[];
  archivedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  date: LocalDate;
  status: EntryStatus;
  /** Quantity, or seconds for timer habits; null for yes/no. */
  value: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What gets saved for a habit on a day. `null` = no entry. */
export interface EntryInput {
  status: EntryStatus;
  value?: number | null;
  note?: string | null;
}

/** Fields the user edits in the habit form. */
export interface HabitDraft {
  name: string;
  icon: string;
  color: string;
  timeOfDay: TimeOfDay;
  frequency: Frequency;
  tracking: Tracking;
  startDate: LocalDate;
  /** Reminder times `HH:mm`. */
  reminders: string[];
}
