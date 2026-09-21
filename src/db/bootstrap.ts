import { useEffect, useState } from 'react';

import { configureNotifications, syncReminders } from '@/lib/notifications';
import { setRepositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';

import { openDatabase } from './client';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

async function bootstrap(): Promise<void> {
  const db = await openDatabase();
  setRepositories(createDrizzleRepositories(db));
  await Promise.all([
    useSettingsStore.getState().load(),
    useHabitsStore.getState().load(),
    useTimerStore.getState().load(),
  ]);
  startReminderSync();
}

/**
 * Keeps local notifications in sync with the habits: once at startup (so one-off reminders
 * roll forward) and after every habit change. Failures are logged, never block the app.
 */
function startReminderSync(): void {
  const sync = (habits: Parameters<typeof syncReminders>[0]) =>
    syncReminders(habits).catch((error: unknown) => console.error('Reminder sync failed', error));

  configureNotifications()
    .then(() => sync(useHabitsStore.getState().habits))
    .catch((error: unknown) => console.error('Notification setup failed', error));

  let timer: ReturnType<typeof setTimeout> | null = null;
  useHabitsStore.subscribe((state, previous) => {
    if (state.habits === previous.habits) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => sync(useHabitsStore.getState().habits), 500);
  });
}

// Module-level so it runs once even if the root layout re-mounts (e.g. fast refresh).
let pending: Promise<void> | null = null;

/** Opens the database, runs migrations and loads the initial app state. */
export function useBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    pending ??= bootstrap();
    pending
      .then(() => !cancelled && setState({ status: 'ready' }))
      .catch((error: unknown) => {
        pending = null;
        if (cancelled) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
