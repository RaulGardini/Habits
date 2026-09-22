import type { Habit } from '@/core/habits/types';
import type { PlannerEvent } from '@/core/planner/types';

// expo-notifications does not support scheduling local notifications on web.
export const notificationsSupported = false;

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function configureNotifications(): Promise<void> {}

export async function getPermission(): Promise<PermissionState> {
  return 'denied';
}

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(
  _habits: readonly Habit[],
  _events: readonly PlannerEvent[] = [],
): Promise<void> {}

export async function cancelAllReminders(): Promise<void> {}
