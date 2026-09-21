import type { HabitDraft } from './types';
import { HABIT_NAME_MAX_LENGTH, hasErrors, validateHabitDraft } from './validation';

const draft: HabitDraft = {
  name: 'Ler',
  icon: 'book-open-variant',
  color: 'violet',
  timeOfDay: 'evening',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-21',
  reminders: [],
};

const errorsOf = (patch: Partial<HabitDraft>) => validateHabitDraft({ ...draft, ...patch });

describe('validateHabitDraft', () => {
  it('accepts a valid draft', () => {
    expect(hasErrors(validateHabitDraft(draft))).toBe(false);
  });

  it('requires a non-blank name', () => {
    expect(errorsOf({ name: '   ' }).name).toBeDefined();
  });

  it('limits the name length (after trimming)', () => {
    const atLimit = 'a'.repeat(HABIT_NAME_MAX_LENGTH);
    expect(errorsOf({ name: ` ${atLimit} ` }).name).toBeUndefined();
    expect(errorsOf({ name: `${atLimit}a` }).name).toBeDefined();
  });

  it('rejects an invalid start date', () => {
    expect(errorsOf({ startDate: '2026-02-30' }).startDate).toBeDefined();
  });

  describe('frequency', () => {
    it('requires at least one weekday', () => {
      expect(errorsOf({ frequency: { type: 'weekdays', days: 0 } }).frequency).toBeDefined();
      expect(errorsOf({ frequency: { type: 'weekdays', days: 0b10 } }).frequency).toBeUndefined();
    });

    it('limits times per week/month', () => {
      const perWeek = (count: number) =>
        errorsOf({ frequency: { type: 'per_period', count, period: 'week' } }).frequency;
      expect(perWeek(0)).toBeDefined();
      expect(perWeek(7)).toBeUndefined();
      expect(perWeek(8)).toBeDefined();
      expect(
        errorsOf({ frequency: { type: 'per_period', count: 20, period: 'month' } }).frequency,
      ).toBeUndefined();
    });

    it('requires an interval of at least 2 whole days', () => {
      expect(errorsOf({ frequency: { type: 'interval', every: 1 } }).frequency).toBeDefined();
      expect(errorsOf({ frequency: { type: 'interval', every: 2.5 } }).frequency).toBeDefined();
      expect(errorsOf({ frequency: { type: 'interval', every: 3 } }).frequency).toBeUndefined();
    });
  });

  describe('tracking', () => {
    it('validates quantity target, unit and step', () => {
      const errors = errorsOf({ tracking: { type: 'quantity', target: NaN, unit: ' ', step: 0 } });
      expect(errors.tracking).toBeDefined();
      expect(errors.unit).toBeDefined();
      expect(errors.step).toBeDefined();
      expect(
        hasErrors(errorsOf({ tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.25 } })),
      ).toBe(false);
    });

    it('validates the timer duration', () => {
      expect(errorsOf({ tracking: { type: 'timer', targetSeconds: 30 } }).tracking).toBeDefined();
      expect(
        errorsOf({ tracking: { type: 'timer', targetSeconds: 1800 } }).tracking,
      ).toBeUndefined();
      expect(
        errorsOf({ tracking: { type: 'timer', targetSeconds: 25 * 3600 } }).tracking,
      ).toBeDefined();
    });
  });

  describe('reminders', () => {
    it('validates times and duplicates', () => {
      expect(errorsOf({ reminders: ['08:00', '21:30'] }).reminders).toBeUndefined();
      expect(errorsOf({ reminders: ['25:00'] }).reminders).toBeDefined();
      expect(errorsOf({ reminders: ['08:00', '08:00'] }).reminders).toBeDefined();
    });
  });
});
