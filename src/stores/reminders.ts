import { addDaysLocal, todayLocal } from '@/core/dates/localDate';
import type { WeekStartsOn } from '@/core/habits/types';
import { ONE_OFF_HORIZON_DAYS, settledToday } from '@/core/reminders/plan';
import { syncReminders } from '@/lib/notifications';
import { getRepositories } from '@/repositories';

/**
 * Re-plans every local notification: habit reminders (none for the rest of today once a habit
 * is settled) + reminders of the agenda events in the scheduling horizon. Call after habit,
 * entry or event changes (bootstrap does it on start and when the app returns).
 *
 * Reads straight from the repositories, so it also works from the Android widget task while
 * the app is closed (the stores are empty there).
 */
export async function rescheduleReminders(): Promise<void> {
  const repos = getRepositories();
  const today = todayLocal();
  const [habits, entries, events, weekStart] = await Promise.all([
    repos.habits.list(),
    // Enough history for this week's and this month's quota of flexible habits.
    repos.entries.listByRange(addDaysLocal(today, -31), today),
    repos.events.listByRange(today, addDaysLocal(today, ONE_OFF_HORIZON_DAYS + 1)),
    repos.settings.get<number>('weekStartsOn'),
  ]);
  const weekStartsOn: WeekStartsOn = weekStart === 1 ? 1 : 0;
  await syncReminders(habits, events, settledToday(habits, entries, today, weekStartsOn));
}
