import { isLocalDate } from '@/core/dates/localDate';

import type { HabitDraft } from './types';

export const HABIT_NAME_MAX_LENGTH = 50;

export type HabitDraftErrors = Partial<Record<keyof HabitDraft, string>>;

export function validateHabitDraft(draft: HabitDraft): HabitDraftErrors {
  const errors: HabitDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = 'Dê um nome ao hábito.';
  } else if (name.length > HABIT_NAME_MAX_LENGTH) {
    errors.name = `Use no máximo ${HABIT_NAME_MAX_LENGTH} caracteres.`;
  }
  if (!isLocalDate(draft.startDate)) errors.startDate = 'Data de início inválida.';
  return errors;
}

export function hasErrors(errors: HabitDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
