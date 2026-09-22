import { weeksGrid } from '@/core/dates/calendar';
import { makeEntry, makeHabit } from '@/core/habits/testing';
import type { EntryStatus, HabitEntry } from '@/core/habits/types';

import {
  habitDailyScores,
  habitDayScore,
  habitStats,
  intensityLevel,
  overallDailyScores,
  summarizeScores,
} from './stats';

let seq = 0;
const entry = (
  habitId: string,
  date: string,
  status: EntryStatus = 'done',
  value: number | null = null,
): HabitEntry => makeEntry({ id: `e${++seq}`, habitId, date, status, value });

const today = '2026-09-21'; // Monday

describe('habitDayScore', () => {
  const habit = makeHabit({ startDate: '2026-09-10' });

  it('is null outside the active range, in the future, or when skipped', () => {
    expect(habitDayScore(habit, '2026-09-09', undefined, today)).toBeNull();
    expect(habitDayScore(habit, '2026-09-22', undefined, today)).toBeNull();
    expect(
      habitDayScore(habit, '2026-09-15', entry('habit-1', '2026-09-15', 'skipped'), today),
    ).toBeNull();
  });

  it('is 0 for a missed past day and 1 when done', () => {
    expect(habitDayScore(habit, '2026-09-15', undefined, today)).toBe(0);
    expect(habitDayScore(habit, '2026-09-15', entry('habit-1', '2026-09-15'), today)).toBe(1);
  });

  it('does not count today until something is recorded', () => {
    expect(habitDayScore(habit, today, undefined, today)).toBeNull();
    expect(habitDayScore(habit, today, entry('habit-1', today), today)).toBe(1);
  });

  it('never shows flexible habits as missed on a given day', () => {
    const flexible = makeHabit({ frequency: { type: 'per_period', count: 3, period: 'week' } });
    expect(habitDayScore(flexible, '2026-09-15', undefined, today)).toBeNull();
    expect(habitDayScore(flexible, '2026-09-15', entry('habit-1', '2026-09-15'), today)).toBe(1);
  });

  it('uses partial progress for quantity habits', () => {
    const water = makeHabit({ tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.5 } });
    expect(
      habitDayScore(water, '2026-09-15', entry('habit-1', '2026-09-15', 'partial', 1), today),
    ).toBe(0.5);
  });
});

describe('overallDailyScores', () => {
  it('averages the habits that count each day', () => {
    const a = makeHabit({ id: 'a' });
    const b = makeHabit({ id: 'b', frequency: { type: 'weekdays', days: 1 << 1 } }); // Mondays
    const scores = overallDailyScores(
      [a, b],
      [entry('a', '2026-09-14'), entry('a', '2026-09-15')],
      { from: '2026-09-14', to: '2026-09-15' },
      today,
      1,
    );
    // Monday 14: a done, b missed → 1/2. Tuesday 15: only a counts → 1.
    expect(scores.get('2026-09-14')).toEqual({ completed: 1, total: 2, ratio: 0.5 });
    expect(scores.get('2026-09-15')).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it('is null for days where nothing counts', () => {
    const scores = overallDailyScores([], [], { from: '2026-09-14', to: '2026-09-14' }, today, 1);
    expect(scores.get('2026-09-14')).toBeNull();
  });

  it('gets stronger as the habits of today are done instead of jumping to full', () => {
    const habits = ['a', 'b', 'c', 'd'].map((id) => makeHabit({ id }));
    const range = { from: today, to: today };
    expect(overallDailyScores(habits, [], range, today, 1).get(today)).toBeNull();
    expect(overallDailyScores(habits, [entry('a', today)], range, today, 1).get(today)).toEqual({
      completed: 1,
      total: 4,
      ratio: 0.25,
    });
  });

  it('counts an open flexible habit as not done, and stops once the quota is met', () => {
    const daily = makeHabit({ id: 'daily' });
    const flexible = makeHabit({
      id: 'flex',
      frequency: { type: 'per_period', count: 1, period: 'week' },
    });
    const scores = overallDailyScores(
      [daily, flexible],
      [
        entry('daily', '2026-09-14'),
        entry('daily', '2026-09-15'),
        entry('flex', '2026-09-15'),
        entry('daily', '2026-09-16'),
      ],
      { from: '2026-09-14', to: '2026-09-16' },
      today,
      1,
    );
    expect(scores.get('2026-09-14')?.ratio).toBe(0.5); // flex still open
    expect(scores.get('2026-09-15')?.ratio).toBe(1); // both done
    expect(scores.get('2026-09-16')?.ratio).toBe(1); // weekly quota met: flex off the list
  });
});

describe('habitDailyScores', () => {
  it('returns one score per day', () => {
    const scores = habitDailyScores(
      makeHabit(),
      [],
      { from: '2026-09-01', to: '2026-09-03' },
      today,
    );
    expect([...scores.values()]).toEqual([0, 0, 0]);
  });
});

describe('intensityLevel', () => {
  it.each([
    [0, 0],
    [0.1, 1],
    [0.25, 1],
    [0.5, 2],
    [0.74, 3],
    [1, 4],
  ])('%f → %i', (ratio, level) => {
    expect(intensityLevel(ratio)).toBe(level);
  });
});

describe('habitStats — fixed days', () => {
  const habit = makeHabit({ startDate: '2026-09-01' });
  const range = { from: '2026-09-01', to: '2026-09-30' };

  it('computes rate, totals and the best weekday', () => {
    const entries = [
      entry('habit-1', '2026-09-14'), // Monday
      entry('habit-1', '2026-09-07'), // Monday
      entry('habit-1', '2026-09-08'), // Tuesday
      entry('habit-1', '2026-09-09', 'skipped'),
    ];
    const stats = habitStats(habit, entries, range, today, 0);
    // Countable: Sep 1–20 = 20 days, minus 1 skipped = 19; today pending is excluded.
    expect(stats.completionRate).toBeCloseTo(3 / 19);
    expect(stats.doneCount).toBe(3);
    expect(stats.bestWeekday).toBe(1);
  });

  it('sums quantity values', () => {
    const water = makeHabit({ tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.5 } });
    const entries = [
      entry('habit-1', '2026-09-02', 'done', 2),
      entry('habit-1', '2026-09-03', 'partial', 1.5),
    ];
    expect(habitStats(water, entries, range, today, 0).totalValue).toBe(3.5);
  });

  it('returns null rate before there is anything to evaluate', () => {
    const fresh = makeHabit({ startDate: today });
    expect(habitStats(fresh, [], range, today, 0).completionRate).toBeNull();
  });
});

describe('habitStats — flexible', () => {
  it('rates by periods, ignoring the current one until met', () => {
    const habit = makeHabit({
      startDate: '2026-09-06',
      frequency: { type: 'per_period', count: 3, period: 'week' },
    });
    const entries = [
      ...['2026-09-06', '2026-09-08', '2026-09-10'].map((d) => entry('habit-1', d)), // week 1: 3/3
      entry('habit-1', '2026-09-15'), // week 2: 1/3
    ];
    const stats = habitStats(
      habit,
      entries,
      { from: '2026-09-01', to: '2026-09-30' },
      '2026-09-22',
      0,
    );
    // Weeks 6–12 (3/3) and 13–19 (1/3); current week 20–26 in progress and not met → skipped.
    expect(stats.completionRate).toBeCloseTo(4 / 6);
  });
});

describe('summarizeScores', () => {
  it('averages active days and counts perfect days', () => {
    const scores = new Map([
      ['a', { completed: 2, total: 2, ratio: 1 }],
      ['b', { completed: 0, total: 2, ratio: 0 }],
      ['c', null],
    ]);
    expect(summarizeScores(scores)).toEqual({ averageRatio: 0.5, perfectDays: 1, activeDays: 2 });
  });
});

describe('weeksGrid', () => {
  it('pads a month into whole weeks', () => {
    // September 2026 starts on a Tuesday.
    const grid = weeksGrid('2026-09-01', '2026-09-30', 0);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toEqual([
      null,
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    expect(grid[4]?.slice(0, 4)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
    expect(grid[4]?.[4]).toBeNull();
  });

  it('respects Monday-based weeks', () => {
    expect(weeksGrid('2026-09-01', '2026-09-30', 1)[0]?.[0]).toBeNull();
    expect(weeksGrid('2026-09-01', '2026-09-30', 1)[0]?.[1]).toBe('2026-09-01');
  });
});
