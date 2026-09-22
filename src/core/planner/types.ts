import type { LocalDate } from '@/core/dates/localDate';

export type TaskPriority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  title: string;
  date: LocalDate;
  priority: TaskPriority;
  completedAt: string | null;
  /** Original day, when the task was rolled over. */
  rolledFrom: LocalDate | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraft {
  title: string;
  date: LocalDate;
  priority: TaskPriority;
}

export type EventRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface EventDraft {
  title: string;
  /** First (or only) day of the event. */
  date: LocalDate;
  allDay: boolean;
  /** `HH:mm`; '00:00' for all-day events. */
  startTime: string;
  endTime: string | null;
  location: string | null;
  color: string;
  note: string | null;
  repeat: EventRepeat;
  /** Last day of the series (inclusive), or null = forever. */
  repeatUntil: LocalDate | null;
  /** Days removed from the series. */
  excludedDates: LocalDate[];
  /** Minutes before the start (all-day events: before 09:00), or null = no reminder. */
  reminderMinutes: number | null;
}

/** Named `PlannerEvent` to avoid clashing with the DOM `Event` type. */
export interface PlannerEvent extends EventDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** One day on which an event happens (a recurring event has many). */
export interface EventOccurrence {
  event: PlannerEvent;
  date: LocalDate;
}

export interface DayNote {
  id: string;
  date: LocalDate;
  content: string;
  updatedAt: string;
}

export type GoalScope = 'month' | 'year';

export interface Goal {
  id: string;
  title: string;
  scope: GoalScope;
  /** `YYYY-MM` (month) or `YYYY` (year). */
  period: string;
  target: number;
  unit: string | null;
  /** Manual progress; ignored when `habitId` is set. */
  current: number;
  habitId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalDraft {
  title: string;
  scope: GoalScope;
  period: string;
  target: number;
  unit: string | null;
  habitId: string | null;
}
