import type { LocalDate } from '@/core/dates/localDate';
import type { DateRange } from '@/core/dates/periods';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { isValidTime } from '@/core/habits/validation';

import type { EventDraft, Goal, GoalDraft, GoalScope } from './types';
import { t } from '@/i18n/i18n';

export const TITLE_MAX_LENGTH = 120;

/** Minutes since midnight of `HH:mm`. */
export function minutesOf(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

// --- Validation -------------------------------------------------------------------------------

export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return t('Informe um título.');
  if (trimmed.length > TITLE_MAX_LENGTH)
    return t('Use no máximo {max} caracteres.', { max: TITLE_MAX_LENGTH });
  return undefined;
}

export function validateEventDraft(draft: EventDraft): Partial<Record<keyof EventDraft, string>> {
  const errors: Partial<Record<keyof EventDraft, string>> = {};
  const title = validateTitle(draft.title);
  if (title) errors.title = title;
  if (draft.repeat !== 'none' && draft.repeatUntil !== null && draft.repeatUntil < draft.date) {
    errors.repeatUntil = t('O fim da repetição deve ser depois do início.');
  }
  if (draft.allDay) return errors;
  if (!isValidTime(draft.startTime)) errors.startTime = t('Horário inválido (use HH:mm).');
  if (draft.endTime !== null) {
    if (!isValidTime(draft.endTime)) errors.endTime = t('Horário inválido (use HH:mm).');
    else if (!errors.startTime && minutesOf(draft.endTime) <= minutesOf(draft.startTime)) {
      errors.endTime = t('O fim deve ser depois do início.');
    }
  }
  return errors;
}

export function validateGoalDraft(draft: GoalDraft): Partial<Record<keyof GoalDraft, string>> {
  const errors: Partial<Record<keyof GoalDraft, string>> = {};
  const title = validateTitle(draft.title);
  if (title) errors.title = title;
  if (!Number.isFinite(draft.target) || draft.target <= 0)
    errors.target = t('Informe uma meta maior que zero.');
  const pattern = draft.scope === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  if (!pattern.test(draft.period)) errors.period = t('Período inválido.');
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
      return t('vezes');
    case 'quantity':
      return habit.tracking.unit;
    case 'timer':
      return t('horas');
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
