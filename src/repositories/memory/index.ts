import type { Habit, HabitEntry } from '@/core/habits/types';

import type { Repositories } from '../types';
import { createMemoryPlannerRepositories } from './planner';

/**
 * In-memory implementation of the repositories. Used by tests; keeps the same
 * observable behavior as the Drizzle implementation (ordering, soft delete, upsert).
 */
export function createMemoryRepositories(initial: { habits?: Habit[] } = {}): Repositories {
  let habits: Habit[] = [...(initial.habits ?? [])];
  let entries: HabitEntry[] = [];
  const settings = new Map<string, string>();
  let sequence = 0;
  const nextId = () => `mem-${++sequence}`;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();

  const find = (id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error(`Habit ${id} not found`);
    return habit;
  };
  const replace = (next: Habit) => {
    habits = habits.map((h) => (h.id === next.id ? next : h));
    return next;
  };

  return {
    habits: {
      async list() {
        return [...habits].sort((a, b) => a.sortOrder - b.sortOrder);
      },
      async getById(id) {
        return habits.find((h) => h.id === id) ?? null;
      },
      async create(draft) {
        const timestamp = now();
        const habit: Habit = {
          id: nextId(),
          ...draft,
          name: draft.name.trim(),
          reminders: [...draft.reminders].sort(),
          archivedAt: null,
          sortOrder: Math.max(-1, ...habits.map((h) => h.sortOrder)) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        habits.push(habit);
        return habit;
      },
      async update(id, draft) {
        return replace({
          ...find(id),
          ...draft,
          name: draft.name.trim(),
          reminders: [...draft.reminders].sort(),
          updatedAt: now(),
        });
      },
      async setArchived(id, archived) {
        const timestamp = now();
        return replace({
          ...find(id),
          archivedAt: archived ? timestamp : null,
          updatedAt: timestamp,
        });
      },
      async remove(id) {
        habits = habits.filter((h) => h.id !== id);
      },
      async reorder(orderedIds) {
        habits = habits.map((h) => {
          const index = orderedIds.indexOf(h.id);
          return index === -1 ? h : { ...h, sortOrder: index };
        });
      },
    },

    entries: {
      async listByDate(date) {
        return entries.filter((e) => e.date === date);
      },
      async listByRange(from, to) {
        return entries
          .filter((e) => e.date >= from && e.date <= to)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
      async listByHabit(habitId) {
        return entries
          .filter((e) => e.habitId === habitId)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
      async upsert(habitId, date, input) {
        const timestamp = now();
        const existing = entries.find((e) => e.habitId === habitId && e.date === date);
        const entry: HabitEntry = {
          id: existing?.id ?? nextId(),
          habitId,
          date,
          status: input.status,
          value: input.value ?? null,
          note: input.note ?? null,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        entries = [...entries.filter((e) => e !== existing), entry];
        return entry;
      },
      async remove(habitId, date) {
        entries = entries.filter((e) => !(e.habitId === habitId && e.date === date));
      },
    },

    settings: {
      async get<T>(key: string) {
        const value = settings.get(key);
        return value === undefined ? null : (JSON.parse(value) as T);
      },
      async set<T>(key: string, value: T) {
        settings.set(key, JSON.stringify(value));
      },
    },

    ...createMemoryPlannerRepositories(nextId, now),
  };
}
