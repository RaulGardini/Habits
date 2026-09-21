import { daysBetween, eachDay, nextPeriodStart, periodRange, shiftPeriod } from './periods';
import {
  hasWeekday,
  maskFromWeekdays,
  orderedWeekdays,
  toggleWeekday,
  weekdaysFromMask,
} from './weekdays';

describe('periodRange', () => {
  it('computes Sunday-based and Monday-based weeks', () => {
    // 2026-09-23 is a Wednesday.
    expect(periodRange('2026-09-23', 'week', 0)).toEqual({ from: '2026-09-20', to: '2026-09-26' });
    expect(periodRange('2026-09-23', 'week', 1)).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    // Sunday with Monday-based weeks belongs to the previous week.
    expect(periodRange('2026-09-20', 'week', 1)).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('computes months and years', () => {
    expect(periodRange('2024-02-10', 'month', 0)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(periodRange('2026-09-23', 'year', 0)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('nextPeriodStart', () => {
  it('returns the first day of the following period', () => {
    expect(nextPeriodStart('2026-09-23', 'week', 0)).toBe('2026-09-27');
    expect(nextPeriodStart('2026-12-15', 'month', 0)).toBe('2027-01-01');
  });
});

describe('shiftPeriod', () => {
  it('moves by weeks, months and years, clamping the day', () => {
    expect(shiftPeriod('2026-09-23', 'week', -1)).toBe('2026-09-16');
    expect(shiftPeriod('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftPeriod('2026-03-15', 'month', -3)).toBe('2025-12-15');
    expect(shiftPeriod('2024-02-29', 'year', 1)).toBe('2025-02-28');
  });
});

describe('daysBetween / eachDay', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(29);
    expect(daysBetween('2026-09-30', '2026-09-01')).toBe(-29);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('lists days inclusively', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(eachDay('2026-03-02', '2026-03-01')).toEqual([]);
  });
});

describe('weekday masks', () => {
  it('converts between masks and weekday lists', () => {
    const mask = maskFromWeekdays([1, 3, 5]);
    expect(weekdaysFromMask(mask)).toEqual([1, 3, 5]);
    expect(hasWeekday(mask, 3)).toBe(true);
    expect(hasWeekday(mask, 2)).toBe(false);
    expect(weekdaysFromMask(toggleWeekday(mask, 3))).toEqual([1, 5]);
  });

  it('orders weekdays by the first day of the week', () => {
    expect(orderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(orderedWeekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
