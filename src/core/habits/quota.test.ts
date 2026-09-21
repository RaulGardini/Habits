import { periodQuota, periodTarget } from './quota';
import { makeEntry, makeHabit } from './testing';

const weekly = makeHabit({
  startDate: '2026-09-01',
  frequency: { type: 'per_period', count: 3, period: 'week' },
});

describe('periodQuota', () => {
  it('counts done entries in the week of the date', () => {
    const entries = [
      makeEntry({ date: '2026-09-13', status: 'done' }), // Sunday, week 13–19
      makeEntry({ date: '2026-09-15', status: 'done' }),
      makeEntry({ date: '2026-09-16', status: 'skipped' }),
      makeEntry({ date: '2026-09-12', status: 'done' }), // previous week
    ];
    expect(periodQuota(weekly, '2026-09-17', entries, 0)).toEqual({
      unit: 'week',
      range: { from: '2026-09-13', to: '2026-09-19' },
      done: 2,
      target: 3,
      met: false,
    });
  });

  it('uses Monday-based weeks when configured', () => {
    const entries = [makeEntry({ date: '2026-09-13', status: 'done' })]; // Sunday
    expect(periodQuota(weekly, '2026-09-14', entries, 1)?.done).toBe(0);
  });

  it('returns null for other frequencies', () => {
    expect(periodQuota(makeHabit(), '2026-09-14', [], 0)).toBeNull();
  });
});

describe('periodTarget', () => {
  it('caps the target by the days left when starting mid-period', () => {
    const lateStart = makeHabit({ ...weekly, startDate: '2026-09-18' }); // Friday
    expect(periodTarget(lateStart, { from: '2026-09-13', to: '2026-09-19' })).toBe(2);
    expect(periodTarget(weekly, { from: '2026-09-13', to: '2026-09-19' })).toBe(3);
  });
});
