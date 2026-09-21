import { and, asc, eq, isNull, max } from 'drizzle-orm';

import type { Habit, HabitDraft } from '@/core/habits/types';
import type { Database } from '@/db/client';
import { habits } from '@/db/schema';
import { newId, nowIso } from '@/lib/id';

import type { HabitRepository } from '../types';
import { toHabit } from './mappers';

const notDeleted = isNull(habits.deletedAt);

function draftColumns(draft: HabitDraft) {
  return {
    name: draft.name.trim(),
    icon: draft.icon,
    color: draft.color,
    timeOfDay: draft.timeOfDay,
    startDate: draft.startDate,
  };
}

export function createDrizzleHabitRepository(db: Database): HabitRepository {
  async function getOrThrow(id: string): Promise<Habit> {
    const row = await db.query.habits.findFirst({ where: and(eq(habits.id, id), notDeleted) });
    if (!row) throw new Error(`Habit ${id} not found`);
    return toHabit(row);
  }

  return {
    async list() {
      const rows = await db.select().from(habits).where(notDeleted).orderBy(asc(habits.sortOrder));
      return rows.map(toHabit);
    },

    async getById(id) {
      const row = await db.query.habits.findFirst({ where: and(eq(habits.id, id), notDeleted) });
      return row ? toHabit(row) : null;
    },

    async create(draft) {
      const [last] = await db
        .select({ value: max(habits.sortOrder) })
        .from(habits)
        .where(notDeleted);
      const now = nowIso();
      const [row] = await db
        .insert(habits)
        .values({
          id: newId(),
          ...draftColumns(draft),
          frequencyType: 'daily',
          trackingType: 'boolean',
          sortOrder: (last?.value ?? -1) + 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error('Failed to create habit');
      return toHabit(row);
    },

    async update(id, draft) {
      await db
        .update(habits)
        .set({ ...draftColumns(draft), updatedAt: nowIso() })
        .where(and(eq(habits.id, id), notDeleted));
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
      await db.update(habits).set({ deletedAt: now, updatedAt: now }).where(eq(habits.id, id));
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
