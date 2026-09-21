import type { Frequency, Habit, HabitEntry, Tracking } from '@/core/habits/types';
import type { HabitEntryRow, HabitRow } from '@/db/schema';

function toFrequency(row: HabitRow): Frequency {
  switch (row.frequencyType) {
    case 'daily':
      return { type: 'daily' };
    default:
      throw new Error(`Unsupported frequency "${row.frequencyType}" for habit ${row.id}`);
  }
}

function toTracking(row: HabitRow): Tracking {
  switch (row.trackingType) {
    case 'boolean':
      return { type: 'boolean' };
    default:
      throw new Error(`Unsupported tracking "${row.trackingType}" for habit ${row.id}`);
  }
}

export function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    timeOfDay: row.timeOfDay,
    frequency: toFrequency(row),
    tracking: toTracking(row),
    startDate: row.startDate,
    archivedAt: row.archivedAt,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toHabitEntry(row: HabitEntryRow): HabitEntry {
  return {
    id: row.id,
    habitId: row.habitId,
    date: row.date,
    status: row.status,
    value: row.value,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
