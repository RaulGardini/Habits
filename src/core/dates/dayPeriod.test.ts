import { getDayPeriod } from './dayPeriod';

const at = (hour: number, minute = 0) => new Date(2026, 8, 21, hour, minute);

describe('getDayPeriod', () => {
  it.each([
    [5, 0, 'morning'],
    [11, 59, 'morning'],
    [12, 0, 'afternoon'],
    [17, 59, 'afternoon'],
    [18, 0, 'evening'],
    [23, 59, 'evening'],
    [0, 0, 'evening'],
    [4, 59, 'evening'],
  ] as const)('%i:%i is %s', (hour, minute, expected) => {
    expect(getDayPeriod(at(hour, minute))).toBe(expected);
  });
});
