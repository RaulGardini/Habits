import { todayLocal, type LocalDate } from '@/core/dates/localDate';
import { incrementEntry, toggleEntry } from '@/core/habits/entries';
import type { WeekStartsOn } from '@/core/habits/types';
import {
  buildWidgetSnapshot,
  widgetHeatmapStart,
  type WidgetSnapshot,
} from '@/core/widgets/snapshot';
import type { Repositories } from '@/repositories';

/** Reads everything the widgets need straight from the repositories (no React/stores). */
export async function loadWidgetSnapshot(
  repos: Repositories,
  today: LocalDate = todayLocal(),
): Promise<WidgetSnapshot> {
  const weekStartsOn: WeekStartsOn =
    (await repos.settings.get<number>('weekStartsOn')) === 1 ? 1 : 0;
  const [habits, entries] = await Promise.all([
    repos.habits.list(),
    repos.entries.listByRange(widgetHeatmapStart(today, weekStartsOn), today),
  ]);
  return buildWidgetSnapshot(habits, entries, today, weekStartsOn);
}

/**
 * Quick action from a widget: toggles a yes/no habit or adds one step to a quantity habit.
 * Returns false when the habit no longer exists or has no quick action.
 */
export async function applyWidgetAction(
  repos: Repositories,
  habitId: string,
  date: LocalDate,
): Promise<boolean> {
  const habit = await repos.habits.getById(habitId);
  if (!habit) return false;
  const entry = (await repos.entries.listByDate(date)).find((e) => e.habitId === habitId);
  let next;
  if (habit.tracking.type === 'boolean') next = toggleEntry(entry);
  else if (habit.tracking.type === 'quantity') next = incrementEntry(habit, entry, 1);
  else return false;
  if (next === null) await repos.entries.remove(habitId, date);
  else await repos.entries.upsert(habitId, date, next);
  return true;
}
