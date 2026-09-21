import { eq, getTableColumns } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  mergeKey,
  planMerge,
  type BackupRow,
  type BackupTable,
  type ImportSummary,
} from '@/core/backup/backup';
import type { Database } from '@/db/client';
import {
  dayNotes,
  events,
  goals,
  habitEntries,
  habitReminders,
  habits,
  settings,
  tasks,
} from '@/db/schema';

import type { BackupRepository } from '../types';

/** Backup tables in dependency order (parents before children). */
const TABLES: Record<BackupTable, SQLiteTable> = {
  habits,
  habitReminders,
  habitEntries,
  tasks,
  events,
  dayNotes,
  goals,
  settings,
};
const IMPORT_ORDER: BackupTable[] = [
  'habits',
  'habitReminders',
  'habitEntries',
  'tasks',
  'events',
  'dayNotes',
  'goals',
  'settings',
];

/** Keeps only real columns of the table (a backup may carry unknown fields). */
function sanitize(table: SQLiteTable, row: BackupRow): Record<string, unknown> {
  const columns = Object.keys(getTableColumns(table));
  return Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]]));
}

/** Column that identifies a stored row (settings use `key`, everything else `id`). */
function identity(name: BackupTable): { column: string } {
  return { column: name === 'settings' ? 'key' : 'id' };
}

export function createDrizzleBackupRepository(db: Database): BackupRepository {
  return {
    async exportAll() {
      const result = {} as Record<BackupTable, BackupRow[]>;
      for (const name of IMPORT_ORDER) {
        result[name] = (await db.select().from(TABLES[name])) as BackupRow[];
      }
      return result;
    },

    async importMerge(tables) {
      const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0 };
      await db.transaction(async (tx) => {
        let habitIds = new Set<string>();
        for (const name of IMPORT_ORDER) {
          const table = TABLES[name];
          const idColumn = getTableColumns(table)[identity(name).column] as SQLiteColumn;
          const existing = (await tx.select().from(table)) as BackupRow[];
          let incoming = tables[name];
          // Children of habits that are not in the database would violate the foreign key.
          if (name === 'habitEntries' || name === 'habitReminders') {
            const before = incoming.length;
            incoming = incoming.filter((row) => habitIds.has(String(row.habitId)));
            summary.skipped += before - incoming.length;
          }

          const plan = planMerge(existing, incoming, mergeKey(name));
          summary.skipped += plan.skipped;
          for (const row of plan.toInsert) {
            await tx.insert(table).values(sanitize(table, row) as never);
            summary.inserted += 1;
          }
          for (const { existing: current, incoming: row } of plan.toUpdate) {
            // Keep the local identity (ids may differ when matched by a natural key).
            const values = sanitize(table, row);
            delete values[identity(name).column];
            await tx
              .update(table)
              .set(values as never)
              .where(eq(idColumn, current[identity(name).column] as string));
            summary.updated += 1;
          }

          if (name === 'habits') {
            const rows = (await tx.select({ id: habits.id }).from(habits)) as { id: string }[];
            habitIds = new Set(rows.map((r) => r.id));
          }
        }
      });
      return summary;
    },

    async deleteAll() {
      await db.transaction(async (tx) => {
        // Children first because of the foreign keys.
        for (const name of [...IMPORT_ORDER].reverse()) {
          await tx.delete(TABLES[name]);
        }
      });
    },
  };
}
