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

/** Named `PlannerEvent` to avoid clashing with the DOM `Event` type. */
export interface PlannerEvent {
  id: string;
  title: string;
  date: LocalDate;
  /** `HH:mm` */
  startTime: string;
  endTime: string | null;
  color: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDraft {
  title: string;
  date: LocalDate;
  startTime: string;
  endTime: string | null;
  color: string;
  note: string | null;
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
