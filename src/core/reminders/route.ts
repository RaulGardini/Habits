import { isLocalDate, type LocalDate } from '@/core/dates/localDate';

import type { PlannedReminder } from './plan';

/** What a notification carries so a tap can open the right screen (strings only). */
export function reminderData(reminder: PlannedReminder): Record<string, string> {
  if (reminder.eventId) {
    return reminder.occurrence
      ? { eventId: reminder.eventId, date: reminder.occurrence }
      : { eventId: reminder.eventId };
  }
  const data: Record<string, string> = { habitId: reminder.habitId ?? '' };
  // One-off habit reminders belong to a fixed day; repeating ones to the day they fire.
  if (reminder.trigger.type === 'date') data.date = reminder.trigger.date;
  return data;
}

/**
 * Route opened by tapping a reminder: the habit's entry for that day, or the event. `null` for
 * anything unexpected (the data comes back from the OS, so it is checked like any input).
 */
export function reminderRoute(data: unknown, today: LocalDate): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { habitId, eventId, date } = data as Record<string, unknown>;
  const day = typeof date === 'string' && isLocalDate(date) && date <= today ? date : null;
  if (typeof eventId === 'string' && eventId) {
    const occurrence = typeof date === 'string' && isLocalDate(date) ? date : null;
    return `/event/${encodeURIComponent(eventId)}${occurrence ? `?date=${occurrence}` : ''}`;
  }
  if (typeof habitId === 'string' && habitId) {
    return `/entry?habitId=${encodeURIComponent(habitId)}&date=${day ?? today}`;
  }
  return null;
}
