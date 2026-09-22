import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { todayLocal } from '@/core/dates/localDate';
import type { Habit } from '@/core/habits/types';
import type { PlannerEvent } from '@/core/planner/types';
import { planReminders, type ReminderTrigger } from '@/core/reminders/plan';
import { t } from '@/i18n/i18n';

/** Local notifications only (no server). Web has a no-op implementation. */
export const notificationsSupported = true;

const CHANNEL_ID = 'reminders';

export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('Lembretes de hábitos'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** Asks for permission if it was never asked. Returns whether notifications are allowed. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

function toTrigger(trigger: ReminderTrigger): Notifications.SchedulableNotificationTriggerInput {
  switch (trigger.type) {
    case 'daily':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId: CHANNEL_ID,
      };
    case 'weekly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: trigger.weekday,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId: CHANNEL_ID,
      };
    case 'date': {
      const [year = 0, month = 1, day = 1] = trigger.date.split('-').map(Number);
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(year, month - 1, day, trigger.hour, trigger.minute),
        channelId: CHANNEL_ID,
      };
    }
  }
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Replaces every scheduled notification with the current plan. Runs sequentially so quick
 * successive changes cannot interleave. Does nothing without permission.
 */
export function syncReminders(
  habits: readonly Habit[],
  events: readonly PlannerEvent[] = [],
): Promise<void> {
  syncing = syncing
    .catch(() => {})
    .then(async () => {
      if ((await getPermission()) !== 'granted') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      const now = new Date();
      for (const reminder of planReminders(habits, todayLocal(now), now, events)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            data: reminder.eventId ? { eventId: reminder.eventId } : { habitId: reminder.habitId },
          },
          trigger: toTrigger(reminder.trigger),
        });
      }
    });
  return syncing;
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
