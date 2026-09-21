import { and, asc, between, eq, isNull } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { habitEntries } from '@/db/schema';
import { newId, nowIso } from '@/lib/id';

import type { EntryRepository } from '../types';
import { toHabitEntry } from './mappers';

const notDeleted = isNull(habitEntries.deletedAt);

export function createDrizzleEntryRepository(db: Database): EntryRepository {
  return {
    async listByDate(date) {
      const rows = await db
        .select()
        .from(habitEntries)
        .where(and(eq(habitEntries.date, date), notDeleted));
      return rows.map(toHabitEntry);
    },

    async listByRange(from, to) {
      const rows = await db
        .select()
        .from(habitEntries)
        .where(and(between(habitEntries.date, from, to), notDeleted))
        .orderBy(asc(habitEntries.date));
      return rows.map(toHabitEntry);
    },

    async upsert(habitId, date, input) {
      const now = nowIso();
      const values = {
        status: input.status,
        value: input.value ?? null,
        note: input.note ?? null,
      };
      // The (habit_id, date) unique index also covers soft-deleted rows, so a
      // conflicting row is revived by clearing deleted_at.
      const [row] = await db
        .insert(habitEntries)
        .values({ id: newId(), habitId, date, ...values, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [habitEntries.habitId, habitEntries.date],
          set: { ...values, updatedAt: now, deletedAt: null },
        })
        .returning();
      if (!row) throw new Error('Failed to save entry');
      return toHabitEntry(row);
    },

    async remove(habitId, date) {
      const now = nowIso();
      await db
        .update(habitEntries)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(habitEntries.habitId, habitId), eq(habitEntries.date, date), notDeleted));
    },
  };
}
