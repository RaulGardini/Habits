import { computeDayProgress, groupByTimeOfDay, highlightedPeriod, nextBooleanStatus } from './day';
import { makeEntry, makeHabit } from './testing';

describe('groupByTimeOfDay', () => {
  it('groups in fixed period order and skips empty groups', () => {
    const habits = [
      makeHabit({ id: 'any', timeOfDay: 'anytime' }),
      makeHabit({ id: 'eve', timeOfDay: 'evening' }),
      makeHabit({ id: 'mor1', timeOfDay: 'morning' }),
      makeHabit({ id: 'mor2', timeOfDay: 'morning' }),
    ];
    const groups = groupByTimeOfDay(habits);
    expect(groups.map((g) => g.timeOfDay)).toEqual(['morning', 'evening', 'anytime']);
    expect(groups[0]?.habits.map((h) => h.id)).toEqual(['mor1', 'mor2']);
  });

  it('returns no groups for no habits', () => {
    expect(groupByTimeOfDay([])).toEqual([]);
  });
});

describe('computeDayProgress', () => {
  const habits = [makeHabit({ id: 'a' }), makeHabit({ id: 'b' }), makeHabit({ id: 'c' })];

  it('counts done entries against all due habits', () => {
    const progress = computeDayProgress(habits, {
      a: makeEntry({ habitId: 'a', status: 'done' }),
      b: makeEntry({ habitId: 'b', status: 'missed' }),
    });
    expect(progress).toEqual({ completed: 1, total: 3, ratio: 1 / 3 });
  });

  it('excludes skipped habits from the total', () => {
    const progress = computeDayProgress(habits, {
      a: makeEntry({ habitId: 'a', status: 'done' }),
      b: makeEntry({ habitId: 'b', status: 'skipped' }),
    });
    expect(progress).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it('does not count partial as completed', () => {
    const progress = computeDayProgress([makeHabit({ id: 'a' })], {
      a: makeEntry({ habitId: 'a', status: 'partial' }),
    });
    expect(progress.completed).toBe(0);
  });

  it('is 0 when there is nothing to do', () => {
    expect(computeDayProgress([], {})).toEqual({ completed: 0, total: 0, ratio: 0 });
  });
});

describe('nextBooleanStatus', () => {
  it('toggles between done and no entry', () => {
    expect(nextBooleanStatus(undefined)).toBe('done');
    expect(nextBooleanStatus('done')).toBeNull();
  });

  it('marks as done from any other status', () => {
    expect(nextBooleanStatus('skipped')).toBe('done');
    expect(nextBooleanStatus('missed')).toBe('done');
  });
});

describe('highlightedPeriod', () => {
  it('highlights the current period only for today', () => {
    expect(highlightedPeriod('2026-09-21', '2026-09-21', 'morning')).toBe('morning');
    expect(highlightedPeriod('2026-09-20', '2026-09-21', 'morning')).toBeNull();
  });
});
