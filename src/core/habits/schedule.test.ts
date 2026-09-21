import { habitsDueOn, isDueOn } from './schedule';
import { makeHabit } from './testing';

describe('isDueOn (daily)', () => {
  const habit = makeHabit({ startDate: '2026-09-10' });

  it('is due every day from the start date', () => {
    expect(isDueOn(habit, '2026-09-10')).toBe(true);
    expect(isDueOn(habit, '2026-09-11')).toBe(true);
    expect(isDueOn(habit, '2027-02-28')).toBe(true);
  });

  it('is not due before the start date', () => {
    expect(isDueOn(habit, '2026-09-09')).toBe(false);
  });

  it('is never due when archived', () => {
    const archived = makeHabit({ archivedAt: '2026-09-15T12:00:00.000Z' });
    expect(isDueOn(archived, '2026-09-21')).toBe(false);
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
