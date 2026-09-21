import type { LocalDate } from '@/core/dates/localDate';

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Phase 1 supports only daily habits; the other frequencies arrive in phase 2. */
export type Frequency = { type: 'daily' };

/** Phase 1 supports only yes/no habits; quantity and timer arrive in phase 2. */
export type Tracking = { type: 'boolean' };

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
  /** Quantity or seconds for quantity/timer habits; null for yes/no. */
  value: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields the user edits in the habit form. */
export interface HabitDraft {
  name: string;
  icon: string;
  color: string;
  timeOfDay: TimeOfDay;
  startDate: LocalDate;
}
