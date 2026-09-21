import { habitEndDate, habitsDueOn, isDueOn, isScheduledOn } from './schedule';
import { makeHabit } from './testing';

// 2026-09-21 is a Monday.
describe('isDueOn — daily', () => {
  const habit = makeHabit({ startDate: '2026-09-10' });

  it('is due every day from the start date', () => {
    expect(isDueOn(habit, '2026-09-10')).toBe(true);
    expect(isDueOn(habit, '2027-02-28')).toBe(true);
  });

  it('is not due before the start date', () => {
    expect(isDueOn(habit, '2026-09-09')).toBe(false);
  });

  it('is never due when archived, but stays scheduled for history', () => {
    const archived = makeHabit({ archivedAt: '2026-09-15T12:00:00.000Z' });
    expect(isDueOn(archived, '2026-09-21')).toBe(false);
    expect(isScheduledOn(archived, '2026-09-21')).toBe(true);
  });
});

describe('isDueOn — specific weekdays', () => {
  const monWedFri = (1 << 1) | (1 << 3) | (1 << 5);
  const habit = makeHabit({ frequency: { type: 'weekdays', days: monWedFri } });

  it.each([
    ['2026-09-20', false], // Sunday
    ['2026-09-21', true], // Monday
    ['2026-09-22', false], // Tuesday
    ['2026-09-23', true], // Wednesday
    ['2026-09-25', true], // Friday
    ['2026-09-26', false], // Saturday
  ])('%s → %s', (date, expected) => {
    expect(isDueOn(habit, date)).toBe(expected);
  });
});

describe('isDueOn — every X days', () => {
  const habit = makeHabit({ startDate: '2026-09-01', frequency: { type: 'interval', every: 3 } });

  it('is due on the start date and every 3 days after', () => {
    expect(
      ['2026-09-01', '2026-09-04', '2026-09-07', '2026-10-01'].map((d) => isDueOn(habit, d)),
    ).toEqual([true, true, true, true]);
    expect(['2026-09-02', '2026-09-03', '2026-09-05'].map((d) => isDueOn(habit, d))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('works across month and year boundaries', () => {
    const h = makeHabit({ startDate: '2026-12-30', frequency: { type: 'interval', every: 2 } });
    expect(isDueOn(h, '2027-01-01')).toBe(true);
    expect(isDueOn(h, '2027-01-02')).toBe(false);
  });
});

describe('isDueOn — X times per period', () => {
  it('is available every day (quota evaluated per period)', () => {
    const habit = makeHabit({ frequency: { type: 'per_period', count: 3, period: 'week' } });
    expect(isDueOn(habit, '2026-09-22')).toBe(true);
  });
});

describe('habitsDueOn', () => {
  it('filters and sorts by sortOrder', () => {
    const habits = [
      makeHabit({ id: 'c', sortOrder: 2 }),
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'future', sortOrder: 1, startDate: '2026-10-01' }),
      makeHabit({ id: 'b', sortOrder: 1 }),
    ];
    expect(habitsDueOn(habits, '2026-09-21').map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('habitEndDate', () => {
  it('is today for active habits', () => {
    expect(habitEndDate(makeHabit(), '2026-09-21')).toBe('2026-09-21');
  });

  it('is the local archive day for archived habits', () => {
    const habit = makeHabit({ archivedAt: new Date(2026, 8, 10, 9).toISOString() });
    expect(habitEndDate(habit, '2026-09-21')).toBe('2026-09-10');
  });
});
