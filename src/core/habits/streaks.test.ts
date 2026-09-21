import { computeStreaks } from './streaks';
import { makeEntry, makeHabit } from './testing';
import type { EntryStatus, HabitEntry } from './types';

let seq = 0;
const entry = (date: string, status: EntryStatus = 'done'): HabitEntry =>
  makeEntry({ id: `e${++seq}`, habitId: 'habit-1', date, status });

// September 2026: 1st = Tuesday, 6th = Sunday, 7th = Monday.
describe('computeStreaks — daily', () => {
  const habit = makeHabit({ startDate: '2026-09-01' });

  it('counts consecutive done days', () => {
    const entries = ['2026-09-01', '2026-09-02', '2026-09-03'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-03', 0)).toEqual({
      current: 3,
      longest: 3,
      unit: 'day',
    });
  });

  it('does not break the current streak while today is pending', () => {
    const entries = ['2026-09-01', '2026-09-02'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-03', 0).current).toBe(2);
  });

  it('breaks on a missed day and keeps the longest', () => {
    const entries = [
      entry('2026-09-01'),
      entry('2026-09-02'),
      entry('2026-09-03'),
      // 09-04 missing
      entry('2026-09-05'),
    ];
    expect(computeStreaks(habit, entries, '2026-09-05', 0)).toMatchObject({
      current: 1,
      longest: 3,
    });
  });

  it('skipped days neither break nor count', () => {
    const entries = [entry('2026-09-01'), entry('2026-09-02', 'skipped'), entry('2026-09-03')];
    expect(computeStreaks(habit, entries, '2026-09-03', 0)).toMatchObject({
      current: 2,
      longest: 2,
    });
  });

  it('partial and missed entries break the streak', () => {
    expect(
      computeStreaks(habit, [entry('2026-09-01'), entry('2026-09-02', 'partial')], '2026-09-03', 0)
        .current,
    ).toBe(0);
    expect(
      computeStreaks(habit, [entry('2026-09-01'), entry('2026-09-02', 'missed')], '2026-09-03', 0)
        .current,
    ).toBe(0);
  });

  it('is zero with no history', () => {
    expect(computeStreaks(habit, [], '2026-09-10', 0)).toEqual({
      current: 0,
      longest: 0,
      unit: 'day',
    });
  });

  it('ignores entries of other habits and before the start date', () => {
    const entries = [
      makeEntry({ id: 'x', habitId: 'other', date: '2026-09-02' }),
      entry('2026-08-31'),
      entry('2026-09-01'),
    ];
    expect(computeStreaks(habit, entries, '2026-09-02', 0).current).toBe(1);
  });
});

describe('computeStreaks — specific weekdays (Mon/Wed/Fri)', () => {
  const monWedFri = (1 << 1) | (1 << 3) | (1 << 5);
  const habit = makeHabit({
    startDate: '2026-09-07',
    frequency: { type: 'weekdays', days: monWedFri },
  });

  it('does not break on unscheduled days (Tuesday)', () => {
    const entries = ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14'].map((d) => entry(d));
    // Tuesday 15th: nothing scheduled, streak continues.
    expect(computeStreaks(habit, entries, '2026-09-15', 0).current).toBe(4);
  });

  it('breaks when a scheduled day is missed', () => {
    const entries = ['2026-09-07', '2026-09-11'].map((d) => entry(d)); // Wednesday 9th missed
    expect(computeStreaks(habit, entries, '2026-09-11', 0)).toMatchObject({
      current: 1,
      longest: 1,
    });
  });
});

describe('computeStreaks — every 2 days', () => {
  const habit = makeHabit({ startDate: '2026-09-01', frequency: { type: 'interval', every: 2 } });

  it('only evaluates scheduled days', () => {
    const entries = ['2026-09-01', '2026-09-03', '2026-09-05'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-06', 0).current).toBe(3);
  });

  it('breaks when a scheduled day is missed', () => {
    const entries = ['2026-09-01', '2026-09-05'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-06', 0).current).toBe(1);
  });
});

describe('computeStreaks — 3x per week', () => {
  // Weeks starting Sunday: 6–12, 13–19, 20–26 September 2026.
  const habit = makeHabit({
    startDate: '2026-09-06',
    frequency: { type: 'per_period', count: 3, period: 'week' },
  });

  it('counts weeks whose quota was met', () => {
    const entries = [
      ...['2026-09-06', '2026-09-08', '2026-09-10'],
      ...['2026-09-14', '2026-09-15', '2026-09-19'],
    ].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-20', 0)).toEqual({
      current: 2,
      longest: 2,
      unit: 'week',
    });
  });

  it('the current week does not break the streak while in progress', () => {
    const entries = ['2026-09-06', '2026-09-08', '2026-09-10', '2026-09-21'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-15', 0).current).toBe(1);
  });

  it('a past week under quota breaks the streak', () => {
    const entries = ['2026-09-06', '2026-09-08', '2026-09-10', '2026-09-14'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-21', 0)).toMatchObject({
      current: 0,
      longest: 1,
    });
  });

  it('lowers the target of a first partial week', () => {
    // Starts on Friday 11th: only 2 days left in that week → target 2.
    const lateStart = makeHabit({ ...habit, startDate: '2026-09-11' });
    const entries = ['2026-09-11', '2026-09-12'].map((d) => entry(d));
    expect(computeStreaks(lateStart, entries, '2026-09-13', 0).current).toBe(1);
  });

  it('respects the first day of the week', () => {
    // Weeks starting Monday: 7–13. Entries Sun 6 (previous week), Mon 7, Tue 8, Wed 9.
    const mondayHabit = makeHabit({ ...habit, startDate: '2026-09-07' });
    const entries = ['2026-09-07', '2026-09-08', '2026-09-09'].map((d) => entry(d));
    expect(computeStreaks(mondayHabit, entries, '2026-09-14', 1).current).toBe(1);
  });
});

describe('computeStreaks — 10x per month', () => {
  it('evaluates by month', () => {
    const habit = makeHabit({
      startDate: '2026-08-01',
      frequency: { type: 'per_period', count: 10, period: 'month' },
    });
    const august = Array.from({ length: 10 }, (_, i) =>
      entry(`2026-08-${String(i + 1).padStart(2, '0')}`),
    );
    expect(computeStreaks(habit, august, '2026-09-05', 0)).toEqual({
      current: 1,
      longest: 1,
      unit: 'month',
    });
  });
});

describe('computeStreaks — archived habits', () => {
  it('stops at the archive day', () => {
    const habit = makeHabit({
      startDate: '2026-09-01',
      archivedAt: new Date(2026, 8, 2, 12).toISOString(),
    });
    const entries = ['2026-09-01', '2026-09-02'].map((d) => entry(d));
    expect(computeStreaks(habit, entries, '2026-09-10', 0).current).toBe(2);
  });
});
