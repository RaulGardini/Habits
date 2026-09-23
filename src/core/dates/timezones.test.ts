import { makeEntry, makeHabit } from '@/core/habits/testing';
import { computeStreaks } from '@/core/habits/streaks';
import { isScheduledOn } from '@/core/habits/schedule';
import { overallDailyScores } from '@/core/stats/stats';

import { addDaysLocal, parseLocalDate, toLocalDate, todayLocal, weekdayOf } from './localDate';
import { daysBetween, eachDay, periodRange } from './periods';

/**
 * Days are local `YYYY-MM-DD` strings; these tests check that nothing shifts with the device
 * time zone or daylight saving changes. Jest cannot switch zones inside a test run, so
 * `npm run test:tz` (scripts/test-timezones.mjs) runs this file once per zone with `TZ` set;
 * a plain `jest` run covers the machine's zone.
 */
/** ICU may report a legacy alias of the requested zone. */
const ALIASES: Record<string, string> = { 'Asia/Calcutta': 'Asia/Kolkata', 'Etc/UTC': 'UTC' };
const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zone = ALIASES[resolved] ?? resolved;
const inZone = (...zones: string[]) => (zones.includes(zone) ? it : it.skip);

it('runs in the requested zone', () => {
  const requested = process.env.TZ;
  if (requested) expect(zone).toBe(requested);
});

it('keeps a check at 23:59 on the same local day', () => {
  expect(toLocalDate(new Date(2026, 8, 22, 23, 59, 59))).toBe('2026-09-22');
  expect(toLocalDate(new Date(2026, 8, 23, 0, 0, 0))).toBe('2026-09-23');
  expect(todayLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
});

it('does day arithmetic without drifting', () => {
  const days = eachDay('2018-01-01', '2020-12-31');
  expect(days).toHaveLength(365 + 365 + 366);
  expect(new Set(days).size).toBe(days.length);
  days.forEach((day, i) => {
    if (i > 0) expect(addDaysLocal(days[i - 1] ?? '', 1)).toBe(day);
    expect(toLocalDate(parseLocalDate(day))).toBe(day);
  });
  expect(daysBetween('2018-01-01', '2020-12-31')).toBe(days.length - 1);
  expect(weekdayOf('2018-11-04')).toBe(0); // Sunday
  expect(periodRange('2018-11-04', 'week', 1)).toEqual({ from: '2018-10-29', to: '2018-11-04' });
  expect(periodRange('2026-11-01', 'month', 0)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
});

it('computes schedules, scores and streaks independently of the zone', () => {
  // Spans the 2018 Brazilian and US DST changes (Nov 4).
  const interval = makeHabit({
    startDate: '2018-10-20',
    frequency: { type: 'interval', every: 3 },
  });
  const daily = makeHabit({ id: 'habit-2', startDate: '2018-10-20' });
  const range = { from: '2018-10-20', to: '2018-11-10' };
  const entries = eachDay(range.from, range.to).flatMap((date, i) => [
    makeEntry({ id: `a${i}`, habitId: interval.id, date }),
    ...(i === 10 ? [] : [makeEntry({ id: `b${i}`, habitId: daily.id, date })]),
  ]);

  expect(eachDay(range.from, range.to).filter((d) => isScheduledOn(interval, d))).toEqual([
    '2018-10-20',
    '2018-10-23',
    '2018-10-26',
    '2018-10-29',
    '2018-11-01',
    '2018-11-04',
    '2018-11-07',
    '2018-11-10',
  ]);
  expect(computeStreaks(daily, entries, range.to, 0)).toMatchObject({ current: 11, longest: 11 });
  const scores = overallDailyScores([interval, daily], entries, range, range.to, 0);
  expect(scores.get('2018-10-30')).toEqual({ completed: 0, total: 1, ratio: 0 }); // i = 10
  expect(scores.get('2018-11-04')).toEqual({ completed: 2, total: 2, ratio: 1 });
  expect(scores.get('2018-11-05')).toEqual({ completed: 1, total: 1, ratio: 1 });
});

describe('daylight saving time', () => {
  inZone('America/Sao_Paulo')('DST start that skips midnight (2018-11-04)', () => {
    // 00:00 does not exist that day: the Date lands at 01:00, still the same day.
    const midnight = parseLocalDate('2018-11-04');
    expect([midnight.getDate(), midnight.getHours()]).toEqual([4, 1]);
    expect(addDaysLocal('2018-11-03', 1)).toBe('2018-11-04');
    expect(addDaysLocal('2018-11-04', -1)).toBe('2018-11-03');
    expect(eachDay('2018-11-03', '2018-11-05')).toEqual(['2018-11-03', '2018-11-04', '2018-11-05']);
  });

  inZone('America/Sao_Paulo')('DST end that repeats 23:00–00:00 (2019-02-16)', () => {
    expect(toLocalDate(new Date('2019-02-17T01:30:00Z'))).toBe('2019-02-16'); // 23:30 (first)
    expect(toLocalDate(new Date('2019-02-17T02:30:00Z'))).toBe('2019-02-16'); // 23:30 (again)
    expect(toLocalDate(new Date('2019-02-17T03:00:00Z'))).toBe('2019-02-17');
  });

  inZone('America/New_York')('23-hour and 25-hour days (2026)', () => {
    expect(new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime()).toBe(23 * 3600e3);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(toLocalDate(new Date('2026-11-01T05:30:00Z'))).toBe('2026-11-01'); // 01:30 EDT
    expect(toLocalDate(new Date('2026-11-01T06:30:00Z'))).toBe('2026-11-01'); // 01:30 EST
  });
});

it('moves "today" with the device zone but never moves stored days', () => {
  const instant = new Date('2026-09-23T02:30:00Z');
  const expected: Record<string, string> = {
    'America/Sao_Paulo': '2026-09-22',
    'America/New_York': '2026-09-22',
    'Pacific/Pago_Pago': '2026-09-22',
    'Asia/Tokyo': '2026-09-23',
    'Asia/Kolkata': '2026-09-23',
    'Pacific/Kiritimati': '2026-09-23',
  };
  if (expected[zone]) expect(todayLocal(instant)).toBe(expected[zone]);
  // A stored day is a plain string: it reads the same in any zone.
  expect(parseLocalDate('2026-09-22').getDate()).toBe(22);
  expect(weekdayOf('2026-09-22')).toBe(2);
});
