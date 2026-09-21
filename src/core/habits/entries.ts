import type { EntryInput, EntryStatus, Habit, HabitEntry, Tracking } from './types';

/** Target value of a habit (quantity or seconds); null for yes/no habits. */
export function trackingTarget(tracking: Tracking): number | null {
  switch (tracking.type) {
    case 'boolean':
      return null;
    case 'quantity':
      return tracking.target;
    case 'timer':
      return tracking.targetSeconds;
  }
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Status implied by a value: done when the target is reached, partial when started. */
export function statusForValue(tracking: Tracking, value: number): EntryStatus | null {
  if (value <= 0) return null;
  const target = trackingTarget(tracking);
  if (target === null) return 'done';
  return value >= target ? 'done' : 'partial';
}

/** 0..1 progress of an entry towards the habit's goal. Skipped/missed/no entry = 0. */
export function entryProgress(habit: Habit, entry: HabitEntry | undefined): number {
  if (!entry || entry.status === 'skipped' || entry.status === 'missed') return 0;
  if (entry.status === 'done') return 1;
  const target = trackingTarget(habit.tracking);
  if (target === null || target <= 0) return 0;
  return Math.min(1, Math.max(0, (entry.value ?? 0) / target));
}

/** Entry after setting the value of a quantity/timer habit. `null` = remove the entry. */
export function entryWithValue(
  habit: Habit,
  entry: HabitEntry | undefined,
  value: number,
): EntryInput | null {
  const next = round(Math.max(0, value));
  const status = statusForValue(habit.tracking, next);
  const note = entry?.note ?? null;
  if (status === null) return note ? { status: 'missed', value: 0, note } : null;
  return { status, value: next, note };
}

/** Entry after tapping + / − on a quantity habit. */
export function incrementEntry(
  habit: Habit,
  entry: HabitEntry | undefined,
  direction: 1 | -1,
): EntryInput | null {
  if (habit.tracking.type !== 'quantity') return entry ? { ...entry } : null;
  return entryWithValue(habit, entry, (entry?.value ?? 0) + direction * habit.tracking.step);
}

/** Entry after tapping the check of a yes/no habit (done ↔ not done). */
export function toggleEntry(entry: HabitEntry | undefined): EntryInput | null {
  if (entry?.status === 'done') {
    return entry.note ? { status: 'missed', value: null, note: entry.note } : null;
  }
  return { status: 'done', value: null, note: entry?.note ?? null };
}

/**
 * Entry after the user picks a status explicitly (entry sheet). Marking a quantity/timer habit
 * as done fills the value up to the target.
 */
export function entryWithStatus(
  habit: Habit,
  entry: HabitEntry | undefined,
  status: EntryStatus,
): EntryInput {
  const target = trackingTarget(habit.tracking);
  const value = entry?.value ?? null;
  if (status === 'done' && target !== null) {
    return { status, value: Math.max(value ?? 0, target), note: entry?.note ?? null };
  }
  return { status, value, note: entry?.note ?? null };
}

/** Choice in the entry sheet. `byValue` derives done/partial from the typed value. */
export type EntrySheetChoice = 'done' | 'byValue' | 'skipped' | 'missed' | 'clear';

export interface EntrySheetInput {
  choice: EntrySheetChoice;
  /** Quantity, or seconds for timers. Ignored for yes/no habits. */
  value: number;
  note: string;
}

/** Entry resulting from the entry sheet form. `null` = remove the entry. */
export function entryFromSheet(habit: Habit, input: EntrySheetInput): EntryInput | null {
  const note = input.note.trim() || null;
  const measurable = trackingTarget(habit.tracking) !== null;
  const value = measurable && Number.isFinite(input.value) ? Math.max(0, input.value) : null;

  switch (input.choice) {
    case 'clear':
      return null;
    case 'skipped':
    case 'missed':
      return { status: input.choice, value, note };
    case 'done':
      return entryWithStatus(habit, formEntry(value, note), 'done');
    case 'byValue':
      if (!measurable) return { status: 'done', value: null, note };
      return entryWithValue(habit, formEntry(value, note), value ?? 0);
  }
}

/** Minimal entry carrying the form's value and note, to reuse the entry rules above. */
function formEntry(value: number | null, note: string | null): HabitEntry {
  return {
    id: '',
    habitId: '',
    date: '',
    status: 'partial',
    value,
    note,
    createdAt: '',
    updatedAt: '',
  };
}
