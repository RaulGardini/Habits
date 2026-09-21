import { useEffect, useState } from 'react';

import { setRepositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';

import { openDatabase } from './client';

export type BootstrapState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

async function bootstrap(): Promise<void> {
  const db = await openDatabase();
  setRepositories(createDrizzleRepositories(db));
  await Promise.all([useSettingsStore.getState().load(), useHabitsStore.getState().load()]);
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
