import type { PlannedReminder } from './plan';
import { reminderData } from './route';

/**
 * Stable identifier of a planned notification: the same habit/event, trigger and text always
 * give the same id, so re-planning only touches what changed.
 */
export function reminderId(reminder: PlannedReminder): string {
  const key = JSON.stringify([
    reminderData(reminder),
    reminder.trigger,
    reminder.title,
    reminder.body,
  ]);
  // FNV-1a, 2 × 32 bits (two seeds): short ids, collisions irrelevant at 60 notifications.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x811c9dc5);
  }
  return `r${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

export interface ScheduleChanges {
  /** Scheduled notifications that are no longer in the plan (cancel these first). */
  cancel: string[];
  /** Planned notifications not scheduled yet. */
  add: { id: string; reminder: PlannedReminder }[];
}

/**
 * What to change on the device to go from `scheduledIds` to `planned`. Usually one or two
 * calls (e.g. checking a habit cancels today's reminder), instead of cancelling and scheduling
 * everything again — which iOS can cut short when the app is left right after a tap.
 */
export function scheduleChanges(
  scheduledIds: readonly string[],
  planned: readonly PlannedReminder[],
): ScheduleChanges {
  const wanted = new Map(planned.map((reminder) => [reminderId(reminder), reminder]));
  const scheduled = new Set(scheduledIds);
  return {
    cancel: [...scheduled].filter((id) => !wanted.has(id)),
    add: [...wanted]
      .filter(([id]) => !scheduled.has(id))
      .map(([id, reminder]) => ({ id, reminder })),
  };
}
