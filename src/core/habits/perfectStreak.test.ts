import type { LocalDate } from '@/core/dates/localDate';
import type { DayScore } from '@/core/stats/stats';

import {
  daysToNextTier,
  flameTierIndex,
  perfectStreak,
  tierProgress,
  FLAME_TIERS,
} from './perfectStreak';

const perfect = (total = 2): DayScore => ({ completed: total, total, ratio: 1 });
const partial = (): DayScore => ({ completed: 1, total: 2, ratio: 0.5 });

const scores = (days: Record<string, DayScore | null>) =>
  new Map<LocalDate, DayScore | null>(Object.entries(days));

const from = '2026-09-14';
const today = '2026-09-22';

describe('perfectStreak', () => {
  it('counts consecutive perfect days back from today', () => {
    const streak = perfectStreak(
      scores({
        '2026-09-19': partial(),
        '2026-09-20': perfect(),
        '2026-09-21': perfect(),
        '2026-09-22': perfect(),
      }),
      from,
      today,
    );
    expect(streak).toEqual({ current: 3, longest: 3, startedOn: '2026-09-20' });
  });

  it('does not break while today is still unfinished', () => {
    const streak = perfectStreak(
      scores({ '2026-09-20': perfect(), '2026-09-21': perfect(), '2026-09-22': partial() }),
      from,
      today,
    );
    expect(streak.current).toBe(2);
  });

  it('skips days where nothing was due', () => {
    const streak = perfectStreak(
      scores({
        '2026-09-19': perfect(),
        '2026-09-20': null,
        '2026-09-21': perfect(),
        '2026-09-22': perfect(),
      }),
      from,
      today,
    );
    expect(streak.current).toBe(3);
  });

  it('breaks on a missed day and remembers the longest run', () => {
    const streak = perfectStreak(
      scores({
        '2026-09-15': perfect(),
        '2026-09-16': perfect(),
        '2026-09-17': perfect(),
        '2026-09-18': perfect(),
        '2026-09-19': partial(),
        '2026-09-21': perfect(),
        '2026-09-22': perfect(),
      }),
      from,
      today,
    );
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(4);
  });

  it('is zero without perfect days', () => {
    expect(perfectStreak(scores({ '2026-09-22': partial() }), from, today)).toEqual({
      current: 0,
      longest: 0,
      startedOn: null,
    });
  });
});

describe('flame tiers', () => {
  it('moves up at each threshold', () => {
    expect(FLAME_TIERS[flameTierIndex(0)]).toBe(0);
    expect(FLAME_TIERS[flameTierIndex(9)]).toBe(0);
    expect(FLAME_TIERS[flameTierIndex(10)]).toBe(10);
    expect(FLAME_TIERS[flameTierIndex(99)]).toBe(50);
    expect(FLAME_TIERS[flameTierIndex(2000)]).toBe(1000);
  });

  it('reports what is missing for the next flame', () => {
    expect(daysToNextTier(7)).toEqual({ threshold: 10, remaining: 3 });
    expect(daysToNextTier(120)).toEqual({ threshold: 200, remaining: 80 });
    expect(daysToNextTier(1200)).toBeNull();
  });

  it('fills the bar between two tiers', () => {
    expect(tierProgress(10)).toBe(0);
    expect(tierProgress(20)).toBe(0.5);
    expect(tierProgress(1500)).toBe(1);
  });
});
