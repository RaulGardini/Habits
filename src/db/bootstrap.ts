import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { configureNotifications } from '@/lib/notifications';
import { useAppLockStore } from '@/stores/appLockStore';
import { useCloudBackupStore } from '@/stores/cloudBackupStore';
import { useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { usePlannerStore } from '@/stores/plannerStore';
import { rescheduleReminders } from '@/stores/reminders';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useTimerStore } from '@/stores/timerStore';
import { consumePendingWidgetActions, updateWidgets } from '@/widgets/sync';

import { initRepositories } from './init';
import { logError } from '@/lib/log';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

async function bootstrap(): Promise<void> {
  await initRepositories();
  await Promise.all([
    useSettingsStore.getState().load(),
    useHabitsStore.getState().load(),
    useTimerStore.getState().load(),
    useAppLockStore.getState().load(),
  ]);
  AppState.addEventListener('change', (status) =>
    useAppLockStore.getState().onAppStateChange(status),
  );
  startReminderSync();
  startWidgetSync();
  startCloudSync();
}

/**
 * Optional cloud sync (only when configured and signed in): on start, when the app returns to
 * the foreground, and a few seconds after local changes.
 */
function startCloudSync(): void {
  const sync = useSyncStore.getState();
  if (!sync.configured) return;
  sync
    .init()
    .then(() => useSyncStore.getState().syncNow())
    .catch((error: unknown) => logError('Sync init failed', error));

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (!useSyncStore.getState().userId) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void useSyncStore.getState().syncNow(), 4000);
  };
  useHabitsStore.subscribe((state, previous) => state.habits !== previous.habits && schedule());
  useEntriesStore.subscribe((state, previous) => state.version !== previous.version && schedule());
  usePlannerStore.subscribe((state, previous) => state.version !== previous.version && schedule());
  useSettingsStore.subscribe((state, previous) => state !== previous && schedule());
  AppState.addEventListener(
    'change',
    (status) => status === 'active' && void useSyncStore.getState().syncNow(),
  );
  // Weekly cloud snapshot, checked after successful syncs.
  useSyncStore.subscribe(
    (state, previous) =>
      state.lastSyncAt !== previous.lastSyncAt && void useCloudBackupStore.getState().autoBackup(),
  );
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
  const run = () => refresh().catch((error: unknown) => logError('Widget sync failed', error));

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
  const sync = () =>
    rescheduleReminders().catch((error: unknown) => logError('Reminder sync failed', error));

  configureNotifications()
    .then(sync)
    .catch((error: unknown) => logError('Notification setup failed', error));

  let timer: ReturnType<typeof setTimeout> | null = null;
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(sync, 500);
  };
  useHabitsStore.subscribe((state, previous) => state.habits !== previous.habits && later());
  // Agenda writes bump the planner version (events may have reminders).
  usePlannerStore.subscribe((state, previous) => state.version !== previous.version && later());
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
