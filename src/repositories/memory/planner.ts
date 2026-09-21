import type { DayNote, Goal, PlannerEvent, Task } from '@/core/planner/types';

import type { Repositories } from '../types';

type PlannerRepositories = Pick<Repositories, 'tasks' | 'events' | 'dayNotes' | 'goals'>;

/** In-memory planner repositories (tests). Same observable behavior as the Drizzle ones. */
export function createMemoryPlannerRepositories(
  nextId: () => string,
  now: () => string,
): PlannerRepositories {
  let tasks: Task[] = [];
  let events: PlannerEvent[] = [];
  const notes = new Map<string, DayNote>();
  let goals: Goal[] = [];

  const findTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    return task;
  };
  const patchTask = (id: string, patch: Partial<Task>) => {
    const next = { ...findTask(id), ...patch, updatedAt: now() };
    tasks = tasks.map((t) => (t.id === id ? next : t));
    return next;
  };

  return {
    tasks: {
      async listByRange(from, to) {
        return tasks.filter((t) => t.date >= from && t.date <= to);
      },
      async listOverdue(date) {
        return tasks.filter((t) => t.date < date && t.completedAt === null);
      },
      async getById(id) {
        return tasks.find((t) => t.id === id) ?? null;
      },
      async create(draft) {
        const timestamp = now();
        const sameDay = tasks.filter((t) => t.date === draft.date);
        const task: Task = {
          id: nextId(),
          title: draft.title.trim(),
          date: draft.date,
          priority: draft.priority,
          completedAt: null,
          rolledFrom: null,
          sortOrder: Math.max(-1, ...sameDay.map((t) => t.sortOrder)) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        tasks.push(task);
        return task;
      },
      async update(id, draft) {
        return patchTask(id, { ...draft, title: draft.title.trim() });
      },
      async setCompleted(id, completed) {
        patchTask(id, { completedAt: completed ? now() : null });
      },
      async moveToDate(ids, date) {
        for (const id of ids) {
          const task = findTask(id);
          patchTask(id, { date, rolledFrom: task.rolledFrom ?? task.date });
        }
      },
      async remove(id) {
        tasks = tasks.filter((t) => t.id !== id);
      },
    },

    events: {
      async listByRange(from, to) {
        return events.filter((e) => e.date >= from && e.date <= to);
      },
      async getById(id) {
        return events.find((e) => e.id === id) ?? null;
      },
      async create(draft) {
        const timestamp = now();
        const event: PlannerEvent = {
          id: nextId(),
          ...draft,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        events.push(event);
        return event;
      },
      async update(id, draft) {
        const existing = events.find((e) => e.id === id);
        if (!existing) throw new Error(`Event ${id} not found`);
        const next = { ...existing, ...draft, updatedAt: now() };
        events = events.map((e) => (e.id === id ? next : e));
        return next;
      },
      async remove(id) {
        events = events.filter((e) => e.id !== id);
      },
    },

    dayNotes: {
      async get(date) {
        return notes.get(date) ?? null;
      },
      async save(date, content) {
        const trimmed = content.trim();
        if (!trimmed) notes.delete(date);
        else
          notes.set(date, {
            id: notes.get(date)?.id ?? nextId(),
            date,
            content: trimmed,
            updatedAt: now(),
          });
      },
    },

    goals: {
      async listByPeriod(scope, period) {
        return goals.filter((g) => g.scope === scope && g.period === period);
      },
      async getById(id) {
        return goals.find((g) => g.id === id) ?? null;
      },
      async create(draft) {
        const timestamp = now();
        const goal: Goal = {
          id: nextId(),
          ...draft,
          current: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        goals.push(goal);
        return goal;
      },
      async update(id, draft) {
        const existing = goals.find((g) => g.id === id);
        if (!existing) throw new Error(`Goal ${id} not found`);
        const next = { ...existing, ...draft, updatedAt: now() };
        goals = goals.map((g) => (g.id === id ? next : g));
        return next;
      },
      async setCurrent(id, current) {
        goals = goals.map((g) => (g.id === id ? { ...g, current: Math.max(0, current) } : g));
      },
      async remove(id) {
        goals = goals.filter((g) => g.id !== id);
      },
    },
  };
}
