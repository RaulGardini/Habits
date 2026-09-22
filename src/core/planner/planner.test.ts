import { makeEntry, makeHabit } from '@/core/habits/testing';

import {
  goalPeriodOf,
  goalPeriodRange,
  goalProgress,
  linkedGoalValue,
  validateEventDraft,
  validateGoalDraft,
} from './planner';
import { makeEvent } from './testing';
import type { Goal } from './types';

const goal = (patch: Partial<Goal>): Goal => ({
  id: 'g',
  title: 'Ler livros',
  scope: 'year',
  period: '2026',
  target: 12,
  unit: 'livros',
  current: 3,
  habitId: null,
  createdAt: '',
  updatedAt: '',
  ...patch,
});

describe('validation', () => {
  it('checks event times', () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...base } = makeEvent({ title: 'Reunião' });
    expect(
      validateEventDraft({ ...base, startTime: '9:00', endTime: null }).startTime,
    ).toBeDefined();
    expect(
      validateEventDraft({ ...base, startTime: '10:00', endTime: '09:00' }).endTime,
    ).toBeDefined();
    expect(validateEventDraft({ ...base, startTime: '10:00', endTime: '11:00' })).toEqual({});
  });

  it('checks goals', () => {
    const base = { title: 'Meta', scope: 'month' as const, unit: null, habitId: null };
    expect(validateGoalDraft({ ...base, period: '2026-09', target: 0 }).target).toBeDefined();
    expect(validateGoalDraft({ ...base, period: '2026', target: 5 }).period).toBeDefined();
    expect(validateGoalDraft({ ...base, period: '2026-09', target: 5 })).toEqual({});
  });
});

describe('goal periods', () => {
  it('derives period keys and ranges', () => {
    expect(goalPeriodOf('2026-09-21', 'month')).toBe('2026-09');
    expect(goalPeriodOf('2026-09-21', 'year')).toBe('2026');
    expect(goalPeriodRange('month', '2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(goalPeriodRange('year', '2026')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('goalProgress', () => {
  it('uses manual progress when not linked', () => {
    expect(goalProgress(goal({}), undefined, [])).toEqual({
      current: 3,
      target: 12,
      unit: 'livros',
      ratio: 0.25,
      achieved: false,
    });
  });

  it('counts completions of a linked yes/no habit in the period', () => {
    const habit = makeHabit({ id: 'h' });
    const entries = [
      makeEntry({ habitId: 'h', date: '2026-03-01', status: 'done' }),
      makeEntry({ habitId: 'h', date: '2026-04-01', status: 'done' }),
      makeEntry({ habitId: 'h', date: '2026-04-02', status: 'missed' }),
      makeEntry({ habitId: 'h', date: '2025-12-31', status: 'done' }),
    ];
    const progress = goalProgress(goal({ habitId: 'h', target: 4 }), habit, entries);
    expect(progress).toMatchObject({ current: 2, unit: 'vezes', ratio: 0.5, achieved: false });
  });

  it('sums quantities and converts timers to hours', () => {
    const water = makeHabit({
      id: 'w',
      tracking: { type: 'quantity', target: 2, unit: 'L', step: 1 },
    });
    const reading = makeHabit({ id: 'r', tracking: { type: 'timer', targetSeconds: 1800 } });
    const range = { from: '2026-09-01', to: '2026-09-30' };
    expect(
      linkedGoalValue(
        water,
        [makeEntry({ habitId: 'w', date: '2026-09-02', status: 'partial', value: 1.5 })],
        range,
      ),
    ).toBe(1.5);
    expect(
      linkedGoalValue(
        reading,
        [makeEntry({ habitId: 'r', date: '2026-09-02', status: 'done', value: 5400 })],
        range,
      ),
    ).toBe(1.5);
  });

  it('caps the ratio at 1 and flags achievement', () => {
    expect(goalProgress(goal({ current: 20 }), undefined, [])).toMatchObject({
      ratio: 1,
      achieved: true,
    });
  });
});
