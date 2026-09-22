import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { configureNotifications, syncReminders } from '@/lib/notifications';
import { useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';
import { consumePendingWidgetActions, updateWidgets } from '@/widgets/sync';

import { initRepositories } from './init';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

async function bootstrap(): Promise<void> {
  await initRepositories();
  await Promise.all([
    useSettingsStore.getState().load(),
    useHabitsStore.getState().load(),
    useTimerStore.getState().load(),
  ]);
  startReminderSync();
  startWidgetSync();
}

/**
 * Keeps home screen widgets in sync: applies quick actions queued by the iOS widget, and
 * redraws widgets whenever habits, entries or settings change or the app returns to foreground.
 */
function startWidgetSync(): void {
  const refresh = async () => {
    if (await consumePendingWidgetActions()) useEntriesStore.getState().reset();
    updateWidgets();
  };
  const run = () => refresh().catch((error: unknown) => console.error('Widget sync failed', error));

  run();
  useHabitsStore.subscribe(
    (state, previous) => state.habits !== previous.habits && updateWidgets(),
  );
  useEntriesStore.subscribe(
    (state, previous) => state.version !== previous.version && updateWidgets(),
  );
  useSettingsStore.subscribe(
    (state, previous) => state.weekStartsOn !== previous.weekStartsOn && updateWidgets(),
  );
  AppState.addEventListener('change', (status) => status === 'active' && run());
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
