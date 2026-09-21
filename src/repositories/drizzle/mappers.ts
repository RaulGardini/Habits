import type { Frequency, Habit, HabitEntry, Tracking } from '@/core/habits/types';
import type { HabitEntryRow, HabitRow } from '@/db/schema';

/**
 * Row → domain. Tolerant of incomplete rows (e.g. from an imported backup): missing
 * parameters fall back to safe defaults instead of crashing the app.
 */
function toFrequency(row: HabitRow): Frequency {
  switch (row.frequencyType) {
    case 'weekdays':
      return row.frequencyWeekdays
        ? { type: 'weekdays', days: row.frequencyWeekdays }
        : { type: 'daily' };
    case 'per_period':
      return {
        type: 'per_period',
        count: Math.max(1, row.frequencyCount ?? 1),
        period: row.frequencyPeriod ?? 'week',
      };
    case 'interval':
      return { type: 'interval', every: Math.max(1, row.frequencyInterval ?? 1) };
    default:
      return { type: 'daily' };
  }
}

function toTracking(row: HabitRow): Tracking {
  switch (row.trackingType) {
    case 'quantity':
      return {
        type: 'quantity',
        target: row.targetValue ?? 1,
        unit: row.unit ?? '',
        step: row.quantityStep ?? 1,
      };
    case 'timer':
      return { type: 'timer', targetSeconds: row.targetValue ?? 60 };
    default:
      return { type: 'boolean' };
  }
}

export function toHabit(row: HabitRow, reminders: string[] = []): Habit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    timeOfDay: row.timeOfDay,
    frequency: toFrequency(row),
    tracking: toTracking(row),
    startDate: row.startDate,
    reminders: [...reminders].sort(),
    archivedAt: row.archivedAt,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Domain frequency → columns (unused parameters are cleared). */
export function frequencyColumns(frequency: Frequency) {
  return {
    frequencyType: frequency.type,
    frequencyWeekdays: frequency.type === 'weekdays' ? frequency.days : null,
    frequencyCount: frequency.type === 'per_period' ? frequency.count : null,
    frequencyPeriod: frequency.type === 'per_period' ? frequency.period : null,
    frequencyInterval: frequency.type === 'interval' ? frequency.every : null,
  };
}

/** Domain tracking → columns (unused parameters are cleared). */
export function trackingColumns(tracking: Tracking) {
  return {
    trackingType: tracking.type,
    targetValue:
      tracking.type === 'quantity'
        ? tracking.target
        : tracking.type === 'timer'
          ? tracking.targetSeconds
          : null,
    unit: tracking.type === 'quantity' ? tracking.unit.trim() : null,
    quantityStep: tracking.type === 'quantity' ? tracking.step : null,
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
