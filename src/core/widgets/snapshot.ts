import { addDaysLocal, type LocalDate } from '@/core/dates/localDate';
import { periodRange } from '@/core/dates/periods';
import { formatClock, formatNumber } from '@/core/format';
import { computeDayProgress } from '@/core/habits/day';
import { entryProgress } from '@/core/habits/entries';
import { habitsDueOn } from '@/core/habits/schedule';
import type { Habit, HabitEntry, WeekStartsOn } from '@/core/habits/types';
import { overallDailyScores } from '@/core/stats/stats';

/** Weeks shown by the heatmap widget. */
export const WIDGET_HEATMAP_WEEKS = 12;
/** Max habits listed by the Today widget. */
export const WIDGET_MAX_HABITS = 8;

/** What a quick tap on a habit in the widget does. */
export type WidgetHabitAction = 'toggle' | 'increment' | 'open';

export interface WidgetHabit {
  id: string;
  name: string;
  /** Habit palette key; widgets resolve it to a color. */
  color: string;
  done: boolean;
  /** 0..1 */
  progress: number;
  /** "1,5 / 2 L", "12:00 / 30 min"; empty for yes/no habits. */
  detail: string;
  action: WidgetHabitAction;
}

/**
 * Everything the widgets display, precomputed by the app. Android renders it in JS; on iOS it
 * is serialized to the shared App Group and decoded by the Swift widget.
 */
export interface WidgetSnapshot {
  date: LocalDate;
  completed: number;
  total: number;
  habits: WidgetHabit[];
  /** Heatmap columns (weeks, oldest first) of 7 days in display order; -1 = does not count. */
  heatmap: number[][];
  weekStartsOn: WeekStartsOn;
}

function detailOf(habit: Habit, entry: HabitEntry | undefined): string {
  const value = entry?.value ?? 0;
  switch (habit.tracking.type) {
    case 'boolean':
      return '';
    case 'quantity':
      return `${formatNumber(value)} / ${formatNumber(habit.tracking.target)} ${habit.tracking.unit}`;
    case 'timer':
      return `${formatClock(value)} / ${Math.round(habit.tracking.targetSeconds / 60)} min`;
  }
}

function actionOf(habit: Habit): WidgetHabitAction {
  switch (habit.tracking.type) {
    case 'boolean':
      return 'toggle';
    case 'quantity':
      return 'increment';
    case 'timer':
      return 'open';
  }
}

/** First day shown by the heatmap widget (start of the week, N−1 weeks ago). */
export function widgetHeatmapStart(today: LocalDate, weekStartsOn: WeekStartsOn): LocalDate {
  return periodRange(addDaysLocal(today, -7 * (WIDGET_HEATMAP_WEEKS - 1)), 'week', weekStartsOn)
    .from;
}

/**
 * @param entries entries from `widgetHeatmapStart(today)` up to today (includes today's).
 */
export function buildWidgetSnapshot(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): WidgetSnapshot {
  const todays: Record<string, HabitEntry | undefined> = {};
  for (const entry of entries) if (entry.date === today) todays[entry.habitId] = entry;

  const due = habitsDueOn(habits, today);
  const progress = computeDayProgress(due, todays);

  const from = widgetHeatmapStart(today, weekStartsOn);
  const to = periodRange(today, 'week', weekStartsOn).to;
  const scores = overallDailyScores(habits, entries, { from, to }, today, weekStartsOn);
  const heatmap: number[][] = [];
  for (let week = 0; week < WIDGET_HEATMAP_WEEKS; week++) {
    const column: number[] = [];
    for (let day = 0; day < 7; day++) {
      const score = scores.get(addDaysLocal(from, week * 7 + day));
      column.push(score ? Math.round(score.ratio * 100) / 100 : -1);
    }
    heatmap.push(column);
  }

  return {
    date: today,
    completed: progress.completed,
    total: progress.total,
    habits: due.slice(0, WIDGET_MAX_HABITS).map((habit) => {
      const entry = todays[habit.id];
      return {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        done: entry?.status === 'done',
        progress: entryProgress(habit, entry),
        detail: detailOf(habit, entry),
        action: actionOf(habit),
      };
    }),
    heatmap,
    weekStartsOn,
  };
}

export interface HeatmapSvgColors {
  /** Series color (#rrggbb). */
  color: string;
  /** Scheduled day with nothing done. */
  empty: string;
  /** Outline of days that do not count. */
  outline: string;
}

/** SVG of the widget heatmap (weeks as columns). Same intensity levels as the app. */
export function heatmapSvg(heatmap: readonly number[][], colors: HeatmapSvgColors): string {
  const cell = 10;
  const gap = 3;
  const width = heatmap.length * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;
  const alpha = [0.3, 0.5, 0.75, 1];
  const rects: string[] = [];
  heatmap.forEach((week, x) =>
    week.forEach((value, y) => {
      const px = x * (cell + gap);
      const py = y * (cell + gap);
      if (value < 0) {
        rects.push(
          `<rect x="${px + 0.5}" y="${py + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="none" stroke="${colors.outline}"/>`,
        );
        return;
      }
      const level = value <= 0 ? 0 : Math.min(4, Math.ceil(value * 4));
      const fill = level === 0 ? colors.empty : colors.color;
      const opacity = level === 0 ? 1 : alpha[level - 1];
      rects.push(
        `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2" fill="${fill}" fill-opacity="${opacity}"/>`,
      );
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects.join('')}</svg>`;
}
