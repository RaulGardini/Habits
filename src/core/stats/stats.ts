import { weekdayOf, type LocalDate } from '@/core/dates/localDate';
import {
  eachDay,
  maxDate,
  minDate,
  nextPeriodStart,
  periodRange,
  type DateRange,
} from '@/core/dates/periods';
import { entryProgress } from '@/core/habits/entries';
import { periodTarget } from '@/core/habits/quota';
import { habitEndDate, isScheduledOn } from '@/core/habits/schedule';
import type { Habit, HabitEntry, WeekStartsOn } from '@/core/habits/types';

/**
 * Score of one habit on one day, 0..1, or `null` when the day does not count:
 * not scheduled, before the start / after the archive day, in the future, or skipped.
 *
 * Flexible habits ("3x per week") have no specific due day, so a day only counts when
 * something was done — they never show as "missed" on a particular day.
 */
export function habitDayScore(
  habit: Habit,
  date: LocalDate,
  entry: HabitEntry | undefined,
  today: LocalDate,
): number | null {
  if (date > today || date > habitEndDate(habit, today) || !isScheduledOn(habit, date)) return null;
  if (entry?.status === 'skipped') return null;
  const progress = entryProgress(habit, entry);
  if (habit.frequency.type === 'per_period') return progress > 0 ? progress : null;
  // Today only counts once something was recorded (the day is not over yet).
  if (date === today && !entry) return null;
  return progress;
}

export interface DayScore {
  /** Habits fully done. */
  completed: number;
  /** Habits that counted for the day. */
  total: number;
  /** 0..1 average progress (partial quantity/timer included). */
  ratio: number;
}

/** Entries indexed by `habitId|date` for fast lookups. */
export function indexEntries(entries: readonly HabitEntry[]): Map<string, HabitEntry> {
  const map = new Map<string, HabitEntry>();
  for (const entry of entries) map.set(`${entry.habitId}|${entry.date}`, entry);
  return map;
}

/**
 * Combined score of all habits for each day of the range (`null` = nothing counted).
 *
 * The denominator is the day's whole list, so the cell gets stronger as habits are done:
 * - today counts every due habit once anything was recorded (pending ones score 0);
 * - a flexible habit counts on days when it was done, and as 0 on days when its period quota
 *   was still open (it was on the list and not done). Entries before `range.from` are not
 *   known here, so quotas met before the range are treated as open.
 */
export function overallDailyScores(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  range: DateRange,
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): Map<LocalDate, DayScore | null> {
  const index = indexEntries(entries);
  const scores = new Map<LocalDate, DayScore | null>();
  for (const date of eachDay(range.from, range.to)) {
    let completed = 0;
    let total = 0;
    let sum = 0;
    let recorded = false;
    for (const habit of habits) {
      const entry = index.get(`${habit.id}|${date}`);
      let score = habitDayScore(habit, date, entry, today);
      if (score === null && isOpenOn(habit, date, entry, today, entries, weekStartsOn)) score = 0;
      if (score === null) continue;
      if (entry) recorded = true;
      total += 1;
      sum += score;
      if (entry?.status === 'done') completed += 1;
    }
    const pendingToday = date === today && !recorded;
    scores.set(date, total === 0 || pendingToday ? null : { completed, total, ratio: sum / total });
  }
  return scores;
}

/** Was the habit on the day's list without a recorded score (see `overallDailyScores`)? */
function isOpenOn(
  habit: Habit,
  date: LocalDate,
  entry: HabitEntry | undefined,
  today: LocalDate,
  entries: readonly HabitEntry[],
  weekStartsOn: WeekStartsOn,
): boolean {
  if (date > today || date > habitEndDate(habit, today) || !isScheduledOn(habit, date))
    return false;
  if (entry?.status === 'skipped') return false;
  if (habit.frequency.type !== 'per_period') return date === today;
  const period = periodRange(date, habit.frequency.period, weekStartsOn);
  const doneBefore = entries.filter(
    (e) =>
      e.habitId === habit.id &&
      e.status === 'done' &&
      e.date >= period.from &&
      e.date < date &&
      e.date >= habit.startDate,
  ).length;
  return doneBefore < periodTarget(habit, period);
}

/** Per-day scores of one habit over the range. */
export function habitDailyScores(
  habit: Habit,
  entries: readonly HabitEntry[],
  range: DateRange,
  today: LocalDate,
): Map<LocalDate, number | null> {
  const index = indexEntries(entries);
  const scores = new Map<LocalDate, number | null>();
  for (const date of eachDay(range.from, range.to)) {
    scores.set(date, habitDayScore(habit, date, index.get(`${habit.id}|${date}`), today));
  }
  return scores;
}

/** Heatmap intensity bucket: 0 = nothing, 1..4 = increasing completion. */
export function intensityLevel(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio <= 0) return 0;
  return Math.min(4, Math.ceil(ratio * 4)) as 1 | 2 | 3 | 4;
}

export interface HabitStats {
  /** Done / countable (0..1), or null when there is nothing to evaluate yet. */
  completionRate: number | null;
  /** Days marked done in the range. */
  doneCount: number;
  /** Sum of recorded values in the range (quantity, or seconds for timers). */
  totalValue: number;
  /** Weekday (0 = Sunday) with the best completion, or null without data. */
  bestWeekday: number | null;
}

/**
 * Statistics of one habit restricted to `range` (clipped to the habit's active days).
 * - Completion rate, fixed-day habits: done / scheduled days (skipped days and a pending
 *   today are left out).
 * - Completion rate, flexible habits: Σ min(done, target) / Σ target over the periods in the
 *   range; the current period only counts once its quota is met.
 */
export function habitStats(
  habit: Habit,
  entries: readonly HabitEntry[],
  range: DateRange,
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): HabitStats {
  const from = maxDate(range.from, habit.startDate);
  const to = minDate(range.to, habitEndDate(habit, today));
  const own = entries.filter((e) => e.habitId === habit.id && e.date >= from && e.date <= to);
  const byDate = new Map(own.map((e) => [e.date, e]));

  const doneCount = own.filter((e) => e.status === 'done').length;
  const totalValue = own.reduce((sum, e) => sum + (e.status === 'skipped' ? 0 : (e.value ?? 0)), 0);

  const weekdayDone = [0, 0, 0, 0, 0, 0, 0];
  const weekdayTotal = [0, 0, 0, 0, 0, 0, 0];
  let countable = 0;
  let achieved = 0;

  if (habit.frequency.type === 'per_period' && from <= to) {
    const unit = habit.frequency.period;
    for (let cursor = from; cursor <= to; cursor = nextPeriodStart(cursor, unit, weekStartsOn)) {
      const period = periodRange(cursor, unit, weekStartsOn);
      const target = periodTarget(habit, period);
      const done = own.filter(
        (e) => e.status === 'done' && e.date >= period.from && e.date <= period.to,
      ).length;
      const inProgress = period.to >= today;
      if (inProgress && done < target) continue;
      countable += target;
      achieved += Math.min(done, target);
    }
    for (const entry of own) {
      if (entry.status !== 'done') continue;
      const weekday = weekdayOf(entry.date);
      weekdayDone[weekday] = (weekdayDone[weekday] ?? 0) + 1;
      weekdayTotal[weekday] = (weekdayTotal[weekday] ?? 0) + 1;
    }
  } else if (from <= to) {
    for (const date of eachDay(from, to)) {
      if (!isScheduledOn(habit, date)) continue;
      const entry = byDate.get(date);
      if (entry?.status === 'skipped') continue;
      if (date === today && entry?.status !== 'done') continue;
      const weekday = weekdayOf(date);
      countable += 1;
      weekdayTotal[weekday] = (weekdayTotal[weekday] ?? 0) + 1;
      if (entry?.status === 'done') {
        achieved += 1;
        weekdayDone[weekday] = (weekdayDone[weekday] ?? 0) + 1;
      }
    }
  }

  return {
    completionRate: countable === 0 ? null : achieved / countable,
    doneCount,
    totalValue,
    bestWeekday: bestWeekday(weekdayDone, weekdayTotal),
  };
}

/** Highest done/total rate; ties go to the weekday with more completions. */
function bestWeekday(done: readonly number[], total: readonly number[]): number | null {
  let best: number | null = null;
  let bestRate = -1;
  let bestDone = -1;
  for (let day = 0; day < 7; day++) {
    const d = done[day] ?? 0;
    const t = total[day] ?? 0;
    if (d === 0 || t === 0) continue;
    const rate = d / t;
    if (rate > bestRate || (rate === bestRate && d > bestDone)) {
      best = day;
      bestRate = rate;
      bestDone = d;
    }
  }
  return best;
}

export interface RangeSummary {
  /** Average of the daily ratios over days that counted. */
  averageRatio: number | null;
  /** Days where every counted habit was done. */
  perfectDays: number;
  /** Days that counted. */
  activeDays: number;
}

export function summarizeScores(scores: ReadonlyMap<LocalDate, DayScore | null>): RangeSummary {
  let sum = 0;
  let activeDays = 0;
  let perfectDays = 0;
  for (const score of scores.values()) {
    if (!score) continue;
    activeDays += 1;
    sum += score.ratio;
    if (score.completed === score.total) perfectDays += 1;
  }
  return { averageRatio: activeDays === 0 ? null : sum / activeDays, perfectDays, activeDays };
}
