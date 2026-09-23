import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';

import type { Habit, HabitDraft } from '@/core/habits/types';
import type { Database } from '@/db/client';
import { habitReminders, habits } from '@/db/schema';
import { newId, nowIso } from '@/lib/id';

import type { HabitRepository } from '../types';
import { frequencyColumns, toHabit, trackingColumns } from './mappers';

/** A transaction handle (`db.transaction(async (tx) => …)`). */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const notDeleted = isNull(habits.deletedAt);
const reminderNotDeleted = isNull(habitReminders.deletedAt);

function draftColumns(draft: HabitDraft) {
  return {
    name: draft.name.trim(),
    icon: draft.icon,
    color: draft.color,
    timeOfDay: draft.timeOfDay,
    startDate: draft.startDate,
    ...frequencyColumns(draft.frequency),
    ...trackingColumns(draft.tracking),
  };
}

export function createDrizzleHabitRepository(db: Database): HabitRepository {
  async function remindersByHabit(habitIds?: string[]): Promise<Map<string, string[]>> {
    const rows = await db
      .select({ habitId: habitReminders.habitId, time: habitReminders.time })
      .from(habitReminders)
      .where(
        habitIds
          ? and(reminderNotDeleted, inArray(habitReminders.habitId, habitIds))
          : reminderNotDeleted,
      );
    const map = new Map<string, string[]>();
    for (const row of rows) map.set(row.habitId, [...(map.get(row.habitId) ?? []), row.time]);
    return map;
  }

  async function getOrThrow(id: string): Promise<Habit> {
    const row = await db.query.habits.findFirst({ where: and(eq(habits.id, id), notDeleted) });
    if (!row) throw new Error(`Habit ${id} not found`);
    return toHabit(row, (await remindersByHabit([id])).get(id));
  }

  /** Keeps unchanged times, soft-deletes removed ones and inserts new ones. */
  async function saveReminders(
    tx: Transaction,
    habitId: string,
    times: readonly string[],
  ): Promise<void> {
    const now = nowIso();
    const existing = await tx
      .select({ id: habitReminders.id, time: habitReminders.time })
      .from(habitReminders)
      .where(and(eq(habitReminders.habitId, habitId), reminderNotDeleted));
    const wanted = new Set(times);
    const removed = existing.filter((r) => !wanted.has(r.time)).map((r) => r.id);
    if (removed.length > 0) {
      await tx
        .update(habitReminders)
        .set({ deletedAt: now, updatedAt: now })
        .where(inArray(habitReminders.id, removed));
    }
    const existingTimes = new Set(existing.map((r) => r.time));
    const added = [...wanted].filter((time) => !existingTimes.has(time));
    if (added.length > 0) {
      await tx
        .insert(habitReminders)
        .values(
          added.map((time) => ({ id: newId(), habitId, time, createdAt: now, updatedAt: now })),
        );
    }
  }

  return {
    async list() {
      const rows = await db.select().from(habits).where(notDeleted).orderBy(asc(habits.sortOrder));
      const reminders = await remindersByHabit();
      return rows.map((row) => toHabit(row, reminders.get(row.id)));
    },

    async getById(id) {
      const row = await db.query.habits.findFirst({ where: and(eq(habits.id, id), notDeleted) });
      return row ? toHabit(row, (await remindersByHabit([id])).get(id)) : null;
    },

    async create(draft) {
      const now = nowIso();
      const id = newId();
      // Habit + reminders are one unit: never a habit without its reminders.
      await db.transaction(async (tx) => {
        const [last] = await tx
          .select({ value: max(habits.sortOrder) })
          .from(habits)
          .where(notDeleted);
        await tx.insert(habits).values({
          id,
          ...draftColumns(draft),
          sortOrder: (last?.value ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        });
        await saveReminders(tx, id, draft.reminders);
      });
      return getOrThrow(id);
    },

    async update(id, draft) {
      await db.transaction(async (tx) => {
        await tx
          .update(habits)
          .set({ ...draftColumns(draft), updatedAt: nowIso() })
          .where(and(eq(habits.id, id), notDeleted));
        await saveReminders(tx, id, draft.reminders);
      });
      return getOrThrow(id);
    },

    async setArchived(id, archived) {
      const now = nowIso();
      await db
        .update(habits)
        .set({ archivedAt: archived ? now : null, updatedAt: now })
        .where(and(eq(habits.id, id), notDeleted));
      return getOrThrow(id);
    },

    async remove(id) {
      const now = nowIso();
      await db.transaction(async (tx) => {
        await tx.update(habits).set({ deletedAt: now, updatedAt: now }).where(eq(habits.id, id));
        await tx
          .update(habitReminders)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(habitReminders.habitId, id), reminderNotDeleted));
      });
    },

    async reorder(orderedIds) {
      const now = nowIso();
      await db.transaction(async (tx) => {
        for (const [index, id] of orderedIds.entries()) {
          await tx
            .update(habits)
            .set({ sortOrder: index, updatedAt: now })
            .where(eq(habits.id, id));
        }
      });
    },
  };
}
