import { isLocalDate } from '@/core/dates/localDate';

import type { Frequency, HabitDraft, Tracking } from './types';

export const HABIT_NAME_MAX_LENGTH = 50;
export const UNIT_MAX_LENGTH = 15;
export const MAX_INTERVAL_DAYS = 365;
export const MAX_TIMER_SECONDS = 24 * 60 * 60;

export type HabitDraftErrors = Partial<Record<keyof HabitDraft | 'unit' | 'step', string>>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isIntegerBetween(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateFrequency(frequency: Frequency): string | undefined {
  switch (frequency.type) {
    case 'daily':
      return undefined;
    case 'weekdays':
      return frequency.days & 0b1111111 ? undefined : 'Escolha pelo menos um dia da semana.';
    case 'per_period': {
      const max = frequency.period === 'week' ? 7 : 31;
      return isIntegerBetween(frequency.count, 1, max)
        ? undefined
        : `Escolha de 1 a ${max} vezes por ${frequency.period === 'week' ? 'semana' : 'mês'}.`;
    }
    case 'interval':
      return isIntegerBetween(frequency.every, 2, MAX_INTERVAL_DAYS)
        ? undefined
        : `O intervalo deve ser de 2 a ${MAX_INTERVAL_DAYS} dias.`;
  }
}

function validateTracking(tracking: Tracking, errors: HabitDraftErrors): void {
  switch (tracking.type) {
    case 'boolean':
      return;
    case 'quantity':
      if (!isPositive(tracking.target)) errors.tracking = 'Informe uma meta maior que zero.';
      if (tracking.unit.trim().length === 0) errors.unit = 'Informe a unidade (ex: L, páginas).';
      else if (tracking.unit.trim().length > UNIT_MAX_LENGTH)
        errors.unit = `Use no máximo ${UNIT_MAX_LENGTH} caracteres.`;
      if (!isPositive(tracking.step)) errors.step = 'O incremento deve ser maior que zero.';
      return;
    case 'timer':
      if (!isPositive(tracking.targetSeconds) || tracking.targetSeconds > MAX_TIMER_SECONDS) {
        errors.tracking = 'Informe uma duração entre 1 minuto e 24 horas.';
      } else if (tracking.targetSeconds < 60) {
        errors.tracking = 'A duração mínima é 1 minuto.';
      }
  }
}

export function validateHabitDraft(draft: HabitDraft): HabitDraftErrors {
  const errors: HabitDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = 'Dê um nome ao hábito.';
  } else if (name.length > HABIT_NAME_MAX_LENGTH) {
    errors.name = `Use no máximo ${HABIT_NAME_MAX_LENGTH} caracteres.`;
  }
  if (!isLocalDate(draft.startDate)) errors.startDate = 'Data de início inválida.';
  const frequencyError = validateFrequency(draft.frequency);
  if (frequencyError) errors.frequency = frequencyError;
  validateTracking(draft.tracking, errors);
  if (draft.reminders.some((time) => !isValidTime(time))) {
    errors.reminders = 'Horário de lembrete inválido.';
  } else if (new Set(draft.reminders).size !== draft.reminders.length) {
    errors.reminders = 'Há lembretes repetidos.';
  }
  return errors;
}

export function hasErrors(errors: HabitDraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}
