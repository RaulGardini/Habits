import { addDaysLocal, type LocalDate } from '@/core/dates/localDate';
import type { DateRange } from '@/core/dates/periods';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { isValidTime } from '@/core/habits/validation';

import type {
  EventDraft,
  Goal,
  GoalDraft,
  GoalScope,
  PlannerEvent,
  Task,
  TaskDraft,
  TaskPriority,
} from './types';

export const TITLE_MAX_LENGTH = 120;

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/** Pending first, then by priority (high → low), then by the user's order. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const doneA = a.completedAt !== null ? 1 : 0;
    const doneB = b.completedAt !== null ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
  });
}

/** Pending tasks planned before `today`. */
export function overdueTasks(tasks: readonly Task[], today: LocalDate): Task[] {
  return tasks.filter((t) => t.completedAt === null && t.date < today);
}

/** Pending tasks of `date`, i.e. what "roll over to tomorrow" would move. */
export function pendingTasks(tasks: readonly Task[], date: LocalDate): Task[] {
  return tasks.filter((t) => t.completedAt === null && t.date === date);
}

export function nextDay(date: LocalDate): LocalDate {
  return addDaysLocal(date, 1);
}

/** Events ordered by start time, then end time, then title. */
export function sortEvents(events: readonly PlannerEvent[]): PlannerEvent[] {
  return [...events].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      (a.endTime ?? '').localeCompare(b.endTime ?? '') ||
      a.title.localeCompare(b.title),
  );
}

/** Minutes since midnight of `HH:mm`. */
export function minutesOf(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

// --- Validation -------------------------------------------------------------------------------

export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'Informe um título.';
  if (trimmed.length > TITLE_MAX_LENGTH) return `Use no máximo ${TITLE_MAX_LENGTH} caracteres.`;
  return undefined;
}

export function validateTaskDraft(draft: TaskDraft): Partial<Record<keyof TaskDraft, string>> {
  const title = validateTitle(draft.title);
  return title ? { title } : {};
}

export function validateEventDraft(draft: EventDraft): Partial<Record<keyof EventDraft, string>> {
  const errors: Partial<Record<keyof EventDraft, string>> = {};
  const title = validateTitle(draft.title);
  if (title) errors.title = title;
  if (!isValidTime(draft.startTime)) errors.startTime = 'Horário inválido (use HH:mm).';
  if (draft.endTime !== null) {
    if (!isValidTime(draft.endTime)) errors.endTime = 'Horário inválido (use HH:mm).';
    else if (!errors.startTime && minutesOf(draft.endTime) <= minutesOf(draft.startTime)) {
      errors.endTime = 'O fim deve ser depois do início.';
    }
  }
  return errors;
}

export function validateGoalDraft(draft: GoalDraft): Partial<Record<keyof GoalDraft, string>> {
  const errors: Partial<Record<keyof GoalDraft, string>> = {};
  const title = validateTitle(draft.title);
  if (title) errors.title = title;
  if (!Number.isFinite(draft.target) || draft.target <= 0)
    errors.target = 'Informe uma meta maior que zero.';
  const pattern = draft.scope === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  if (!pattern.test(draft.period)) errors.period = 'Período inválido.';
  return errors;
}

// --- Goals ------------------------------------------------------------------------------------

/** Period key of a date for a scope: `2026-09` or `2026`. */
export function goalPeriodOf(date: LocalDate, scope: GoalScope): string {
  return scope === 'month' ? date.slice(0, 7) : date.slice(0, 4);
}

export function goalPeriodRange(scope: GoalScope, period: string): DateRange {
  if (scope === 'year') return { from: `${period}-01-01`, to: `${period}-12-31` };
  const [year = 0, month = 1] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
}

/** Unit shown for a goal linked to a habit: "vezes", the quantity unit, or "horas". */
export function linkedGoalUnit(habit: Habit): string {
  switch (habit.tracking.type) {
    case 'boolean':
      return 'vezes';
    case 'quantity':
      return habit.tracking.unit;
    case 'timer':
      return 'horas';
  }
}

/** Progress of a habit-linked goal: completions, quantity sum, or hours. */
export function linkedGoalValue(
  habit: Habit,
  entries: readonly HabitEntry[],
  range: DateRange,
): number {
  const own = entries.filter(
    (e) =>
      e.habitId === habit.id &&
      e.date >= range.from &&
      e.date <= range.to &&
      e.status !== 'skipped',
  );
  switch (habit.tracking.type) {
    case 'boolean':
      return own.filter((e) => e.status === 'done').length;
    case 'quantity':
      return own.reduce((sum, e) => sum + (e.value ?? 0), 0);
    case 'timer':
      return Math.round((own.reduce((sum, e) => sum + (e.value ?? 0), 0) / 3600) * 10) / 10;
  }
}

export interface GoalProgress {
  current: number;
  target: number;
  unit: string | null;
  /** 0..1 */
  ratio: number;
  achieved: boolean;
}

export function goalProgress(
  goal: Goal,
  habit: Habit | undefined,
  entries: readonly HabitEntry[],
): GoalProgress {
  const linked = goal.habitId !== null && habit !== undefined;
  const current = linked
    ? linkedGoalValue(habit, entries, goalPeriodRange(goal.scope, goal.period))
    : goal.current;
  const ratio = goal.target > 0 ? Math.min(1, Math.max(0, current / goal.target)) : 0;
  return {
    current,
    target: goal.target,
    unit: linked ? linkedGoalUnit(habit) : goal.unit,
    ratio,
    achieved: current >= goal.target,
  };
}

// --- Month overview ---------------------------------------------------------------------------

export interface DayPlanSummary {
  pendingTasks: number;
  doneTasks: number;
  events: number;
}

export function summarizeDays(
  tasks: readonly Task[],
  events: readonly PlannerEvent[],
): Map<LocalDate, DayPlanSummary> {
  const map = new Map<LocalDate, DayPlanSummary>();
  const get = (date: LocalDate) => {
    let summary = map.get(date);
    if (!summary) {
      summary = { pendingTasks: 0, doneTasks: 0, events: 0 };
      map.set(date, summary);
    }
    return summary;
  };
  for (const task of tasks) {
    const summary = get(task.date);
    if (task.completedAt === null) summary.pendingTasks += 1;
    else summary.doneTasks += 1;
  }
  for (const event of events) get(event.date).events += 1;
  return map;
}
