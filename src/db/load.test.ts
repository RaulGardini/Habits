import { addDaysLocal } from '@/core/dates/localDate';
import { periodRange } from '@/core/dates/periods';
import { perfectStreak } from '@/core/habits/perfectStreak';
import { habitsDueOn } from '@/core/habits/schedule';
import { computeStreaks } from '@/core/habits/streaks';
import type { HabitEntry } from '@/core/habits/types';
import { habitStats, overallDailyScores } from '@/core/stats/stats';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import type { Repositories } from '@/repositories/types';

import { insertSeedData } from './loadTest';
import { generateSeedData } from './seed';
import { openTestDatabase, type TestDatabase } from './testing';

/**
 * Load test: 40 habits × 3 years of realistic data. Checks that every hot query uses an index
 * and that the computations behind Today (streaks, perfect-day streak) and the yearly heatmap
 * stay fast. Query times are not asserted: sql.js under Jest decodes strings through a slow
 * polyfill, so they say nothing about a device (measure those with `?loadtest` on web).
 */
jest.setTimeout(120_000);

const TODAY = '2026-09-23';
const data = generateSeedData({ today: TODAY });
let test: TestDatabase;
let repos: Repositories;

beforeAll(async () => {
  test = await openTestDatabase();
  repos = createDrizzleRepositories(test.db);
  await insertSeedData(test.db, data);
});

/** Wall time of a synchronous computation (best of 3, to ignore JIT warm-up and GC). */
function timed<T>(run: () => T): { result: T; ms: number } {
  let best = Infinity;
  let result = run();
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    result = run();
    best = Math.min(best, performance.now() - start);
  }
  return { result, ms: best };
}

it('seeds a realistic volume', () => {
  expect(data.habits).toHaveLength(40);
  expect(data.habitEntries.length).toBeGreaterThan(40_000);
  expect(data.tasks.length).toBeGreaterThan(3_000);
  expect(data.events.length).toBeGreaterThan(300);
  expect(data.dayNotes.length).toBeGreaterThan(500);
});

describe('query plans', () => {
  /** Runs a repository call and returns the plans of the statements it sent. */
  async function plansOf(call: () => Promise<unknown>): Promise<string[]> {
    const before = test.queries.length;
    await call();
    return test.queries.slice(before).map(({ sql, params }) => {
      const [result] = test.sqlite.exec(`EXPLAIN QUERY PLAN ${sql}`, params as never);
      return (result?.values ?? []).map((row) => String(row[3])).join(' / ');
    });
  }

  it.each([
    ['entries of a day', () => repos.entries.listByDate(TODAY), 'habit_entries_date_idx'],
    ['entries of a range', () => repos.entries.listByRange('2026-01-01', TODAY), 'date_idx'],
    ['history of a habit', () => repos.entries.listByHabit('seed-habit-0'), 'habit_date_uq'],
    ['tasks of a range', () => repos.tasks.listByRange('2026-09-01', '2026-09-30'), 'tasks_date'],
    ['day note', () => repos.dayNotes.get(TODAY), 'day_notes_date_uq'],
    ['goals of a month', () => repos.goals.listByPeriod('month', '2026-09'), 'goals_scope'],
  ])('%s uses an index', async (_, call, index) => {
    const [plan] = await plansOf(call);
    expect(plan).toMatch(/SEARCH .* USING (COVERING )?INDEX/);
    expect(plan).toContain(index);
    expect(plan).not.toMatch(/\bSCAN\b/);
  });

  it('events of a range use the date index and the partial index for series', async () => {
    const [plan] = await plansOf(() => repos.events.listByRange('2026-09-01', '2026-09-30'));
    expect(plan).toContain('MULTI-INDEX OR');
    expect(plan).toContain('events_date_idx');
    expect(plan).toContain('events_series_idx');
    expect(plan).not.toMatch(/\bSCAN\b/);
  });

  it('still returns every series that runs in the range', async () => {
    const events = await repos.events.listByRange('2026-09-01', '2026-09-30');
    const series = events.filter((e) => e.repeat !== 'none').map((e) => e.id);
    const expected = data.events
      .filter(
        (e) =>
          e.repeat !== 'none' &&
          String(e.date) <= '2026-09-30' &&
          (e.repeatUntil === null || String(e.repeatUntil) >= '2026-09-01'),
      )
      .map((e) => String(e.id));
    expect(series.sort()).toEqual(expected.sort());
  });
});

describe('computations on 3 years of data', () => {
  let history: HabitEntry[];
  beforeAll(async () => {
    history = await repos.entries.listByRange(addDaysLocal(TODAY, -1200), TODAY);
  });

  it('computes the perfect-day streak quickly (Today screen)', async () => {
    const habits = await repos.habits.list();
    const from = addDaysLocal(TODAY, -1200);
    const { ms } = timed(() =>
      perfectStreak(
        overallDailyScores(habits, history, { from, to: TODAY }, TODAY, 0),
        from,
        TODAY,
      ),
    );
    // Was ~4 s before the quadratic scan of flexible habits was removed.
    expect(ms).toBeLessThan(400);
  });

  it('computes every habit streak quickly (Today and Stats screens)', async () => {
    const due = habitsDueOn(await repos.habits.list(), TODAY);
    const byHabit = new Map<string, HabitEntry[]>();
    for (const entry of history) {
      const own = byHabit.get(entry.habitId) ?? [];
      own.push(entry);
      byHabit.set(entry.habitId, own);
    }
    const { result, ms } = timed(() =>
      due.map((h) => computeStreaks(h, byHabit.get(h.id) ?? [], TODAY, 0)),
    );
    expect(result).toHaveLength(due.length);
    expect(ms).toBeLessThan(400);
  });

  it('computes the yearly heatmap and per-habit stats quickly', async () => {
    const habits = await repos.habits.list();
    const year = periodRange(TODAY, 'year', 0);
    const entries = await repos.entries.listByRange(year.from, year.to);
    const { result, ms } = timed(() => {
      const scores = overallDailyScores(habits, entries, year, TODAY, 0);
      for (const habit of habits) habitStats(habit, entries, year, TODAY, 0);
      return scores;
    });
    expect(result.size).toBe(365);
    expect(ms).toBeLessThan(400);
  });
});
