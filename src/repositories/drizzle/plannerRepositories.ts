import { and, between, eq, isNull, lt, max } from 'drizzle-orm';

import type { DayNote, Goal, PlannerEvent, Task } from '@/core/planner/types';
import type { Database } from '@/db/client';
import {
  dayNotes,
  events,
  goals,
  tasks,
  type DayNoteRow,
  type EventRow,
  type GoalRow,
  type TaskRow,
} from '@/db/schema';
import { newId, nowIso } from '@/lib/id';

import type { DayNoteRepository, EventRepository, GoalRepository, TaskRepository } from '../types';

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  date: row.date,
  priority: row.priority,
  completedAt: row.completedAt,
  rolledFrom: row.rolledFrom,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toEvent = (row: EventRow): PlannerEvent => ({
  id: row.id,
  title: row.title,
  date: row.date,
  startTime: row.startTime,
  endTime: row.endTime,
  color: row.color,
  note: row.note,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toDayNote = (row: DayNoteRow): DayNote => ({
  id: row.id,
  date: row.date,
  content: row.content,
  updatedAt: row.updatedAt,
});

const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  title: row.title,
  scope: row.scope,
  period: row.period,
  target: row.target,
  unit: row.unit,
  current: row.current,
  habitId: row.habitId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export function createDrizzleTaskRepository(db: Database): TaskRepository {
  const alive = isNull(tasks.deletedAt);
  async function getOrThrow(id: string): Promise<Task> {
    const row = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), alive) });
    if (!row) throw new Error(`Task ${id} not found`);
    return toTask(row);
  }

  return {
    async listByRange(from, to) {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(between(tasks.date, from, to), alive));
      return rows.map(toTask);
    },

    async listOverdue(date) {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(lt(tasks.date, date), isNull(tasks.completedAt), alive));
      return rows.map(toTask);
    },

    async getById(id) {
      const row = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), alive) });
      return row ? toTask(row) : null;
    },

    async create(draft) {
      const [last] = await db
        .select({ value: max(tasks.sortOrder) })
        .from(tasks)
        .where(and(eq(tasks.date, draft.date), alive));
      const now = nowIso();
      const id = newId();
      await db.insert(tasks).values({
        id,
        title: draft.title.trim(),
        date: draft.date,
        priority: draft.priority,
        sortOrder: (last?.value ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      });
      return getOrThrow(id);
    },

    async update(id, draft) {
      await db
        .update(tasks)
        .set({
          title: draft.title.trim(),
          date: draft.date,
          priority: draft.priority,
          updatedAt: nowIso(),
        })
        .where(and(eq(tasks.id, id), alive));
      return getOrThrow(id);
    },

    async setCompleted(id, completed) {
      const now = nowIso();
      await db
        .update(tasks)
        .set({ completedAt: completed ? now : null, updatedAt: now })
        .where(eq(tasks.id, id));
    },

    async moveToDate(ids, date) {
      if (ids.length === 0) return;
      const now = nowIso();
      await db.transaction(async (tx) => {
        for (const id of ids) {
          const row = await tx.query.tasks.findFirst({ where: eq(tasks.id, id) });
          if (!row) continue;
          await tx
            .update(tasks)
            .set({ date, rolledFrom: row.rolledFrom ?? row.date, updatedAt: now })
            .where(eq(tasks.id, id));
        }
      });
    },

    async remove(id) {
      const now = nowIso();
      await db.update(tasks).set({ deletedAt: now, updatedAt: now }).where(eq(tasks.id, id));
    },
  };
}

export function createDrizzleEventRepository(db: Database): EventRepository {
  const alive = isNull(events.deletedAt);
  const columns = (draft: Parameters<EventRepository['create']>[0]) => ({
    title: draft.title.trim(),
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    color: draft.color,
    note: draft.note?.trim() || null,
  });
  async function getOrThrow(id: string): Promise<PlannerEvent> {
    const row = await db.query.events.findFirst({ where: and(eq(events.id, id), alive) });
    if (!row) throw new Error(`Event ${id} not found`);
    return toEvent(row);
  }

  return {
    async listByRange(from, to) {
      const rows = await db
        .select()
        .from(events)
        .where(and(between(events.date, from, to), alive));
      return rows.map(toEvent);
    },

    async getById(id) {
      const row = await db.query.events.findFirst({ where: and(eq(events.id, id), alive) });
      return row ? toEvent(row) : null;
    },

    async create(draft) {
      const now = nowIso();
      const id = newId();
      await db.insert(events).values({ id, ...columns(draft), createdAt: now, updatedAt: now });
      return getOrThrow(id);
    },

    async update(id, draft) {
      await db
        .update(events)
        .set({ ...columns(draft), updatedAt: nowIso() })
        .where(and(eq(events.id, id), alive));
      return getOrThrow(id);
    },

    async remove(id) {
      const now = nowIso();
      await db.update(events).set({ deletedAt: now, updatedAt: now }).where(eq(events.id, id));
    },
  };
}

export function createDrizzleDayNoteRepository(db: Database): DayNoteRepository {
  return {
    async get(date) {
      const row = await db.query.dayNotes.findFirst({
        where: and(eq(dayNotes.date, date), isNull(dayNotes.deletedAt)),
      });
      return row ? toDayNote(row) : null;
    },

    async save(date, content) {
      const now = nowIso();
      const trimmed = content.trim();
      // The unique (date) index also covers soft-deleted rows: revive them on conflict.
      await db
        .insert(dayNotes)
        .values({
          id: newId(),
          date,
          content: trimmed,
          createdAt: now,
          updatedAt: now,
          deletedAt: trimmed ? null : now,
        })
        .onConflictDoUpdate({
          target: dayNotes.date,
          set: { content: trimmed, updatedAt: now, deletedAt: trimmed ? null : now },
        });
    },
  };
}

export function createDrizzleGoalRepository(db: Database): GoalRepository {
  const alive = isNull(goals.deletedAt);
  const columns = (draft: Parameters<GoalRepository['create']>[0]) => ({
    title: draft.title.trim(),
    scope: draft.scope,
    period: draft.period,
    target: draft.target,
    unit: draft.unit?.trim() || null,
    habitId: draft.habitId,
  });
  async function getOrThrow(id: string): Promise<Goal> {
    const row = await db.query.goals.findFirst({ where: and(eq(goals.id, id), alive) });
    if (!row) throw new Error(`Goal ${id} not found`);
    return toGoal(row);
  }

  return {
    async listByPeriod(scope, period) {
      const rows = await db
        .select()
        .from(goals)
        .where(and(eq(goals.scope, scope), eq(goals.period, period), alive));
      return rows.map(toGoal).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async getById(id) {
      const row = await db.query.goals.findFirst({ where: and(eq(goals.id, id), alive) });
      return row ? toGoal(row) : null;
    },

    async create(draft) {
      const now = nowIso();
      const id = newId();
      await db.insert(goals).values({ id, ...columns(draft), createdAt: now, updatedAt: now });
      return getOrThrow(id);
    },

    async update(id, draft) {
      await db
        .update(goals)
        .set({ ...columns(draft), updatedAt: nowIso() })
        .where(and(eq(goals.id, id), alive));
      return getOrThrow(id);
    },

    async setCurrent(id, current) {
      await db
        .update(goals)
        .set({ current: Math.max(0, current), updatedAt: nowIso() })
        .where(eq(goals.id, id));
    },

    async remove(id) {
      const now = nowIso();
      await db.update(goals).set({ deletedAt: now, updatedAt: now }).where(eq(goals.id, id));
    },
  };
}
