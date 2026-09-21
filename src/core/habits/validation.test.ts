import type { HabitDraft } from './types';
import { HABIT_NAME_MAX_LENGTH, hasErrors, validateHabitDraft } from './validation';

const draft: HabitDraft = {
  name: 'Ler',
  icon: 'book-open-variant',
  color: 'violet',
  timeOfDay: 'evening',
  startDate: '2026-09-21',
};

describe('validateHabitDraft', () => {
  it('accepts a valid draft', () => {
    expect(hasErrors(validateHabitDraft(draft))).toBe(false);
  });

  it('requires a non-blank name', () => {
    expect(validateHabitDraft({ ...draft, name: '   ' }).name).toBeDefined();
  });

  it('limits the name length (after trimming)', () => {
    const atLimit = 'a'.repeat(HABIT_NAME_MAX_LENGTH);
    expect(validateHabitDraft({ ...draft, name: ` ${atLimit} ` }).name).toBeUndefined();
    expect(validateHabitDraft({ ...draft, name: `${atLimit}a` }).name).toBeDefined();
  });

  it('rejects an invalid start date', () => {
    expect(validateHabitDraft({ ...draft, startDate: '2026-02-30' }).startDate).toBeDefined();
  });
});
