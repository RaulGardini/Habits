import { create } from 'zustand';

import { shouldLockOnReturn } from '@/core/security/appLock';
import { t } from '@/i18n/i18n';
import { authenticate, canLockApp } from '@/lib/localAuth';
import { getRepositories } from '@/repositories';

/** Device-only setting (never synced: see LOCAL_ONLY_SETTINGS). */
export const APP_LOCK_KEY = 'appLock';

interface AppLockState {
  /** The device can authenticate the user (biometrics or passcode). */
  available: boolean;
  enabled: boolean;
  /** The app content is hidden until the user authenticates. */
  locked: boolean;
  load(): Promise<void>;
  /** Turning it on asks to authenticate first (so nobody locks themselves out). */
  setEnabled(enabled: boolean): Promise<boolean>;
  unlock(): Promise<boolean>;
  /** Called on AppState changes. */
  onAppStateChange(status: string, now?: number): void;
}

let backgroundedAt: number | null = null;
let unlocking: Promise<boolean> | null = null;

export const useAppLockStore = create<AppLockState>()((set, get) => ({
  available: false,
  enabled: false,
  locked: false,

  async load() {
    const [available, stored] = await Promise.all([
      canLockApp(),
      getRepositories().settings.get<boolean>(APP_LOCK_KEY),
    ]);
    const enabled = stored === true && available;
    // A cold start with the lock on always starts locked.
    set({ available, enabled, locked: enabled });
  },

  async setEnabled(enabled) {
    if (enabled && !(await authenticate(t('Confirme para ligar o bloqueio')))) return false;
    await getRepositories().settings.set(APP_LOCK_KEY, enabled);
    set({ enabled, locked: false });
    return true;
  },

  unlock() {
    // The system prompt itself moves the app to "inactive": never stack two prompts.
    unlocking ??= authenticate(t('Desbloquear o Habits'))
      .then((success) => {
        if (success) set({ locked: false });
        return success;
      })
      .finally(() => {
        unlocking = null;
      });
    return unlocking;
  },

  onAppStateChange(status, now = Date.now()) {
    if (status === 'background') {
      backgroundedAt ??= now;
      return;
    }
    if (status !== 'active') return;
    if (shouldLockOnReturn(get().enabled, backgroundedAt, now)) set({ locked: true });
    backgroundedAt = null;
  },
}));
