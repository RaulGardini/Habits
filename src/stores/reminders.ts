import { addDaysLocal, todayLocal } from '@/core/dates/localDate';
import { ONE_OFF_HORIZON_DAYS } from '@/core/reminders/plan';
import { syncReminders } from '@/lib/notifications';
import { getRepositories } from '@/repositories';

import { useHabitsStore } from './habitsStore';

/**
 * Re-plans every local notification: habit reminders + reminders of the agenda events in the
 * scheduling horizon. Call after habit or event changes (bootstrap does it on start).
 */
export async function rescheduleReminders(): Promise<void> {
  const today = todayLocal();
  const events = await getRepositories().events.listByRange(
    today,
    addDaysLocal(today, ONE_OFF_HORIZON_DAYS + 1),
  );
  await syncReminders(useHabitsStore.getState().habits, events);
}
