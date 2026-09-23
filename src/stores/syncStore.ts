import { create } from 'zustand';

import {
  INITIAL_SYNC_STATE,
  authErrorMessage,
  retryDelayMs,
  type SyncState,
} from '@/core/sync/sync';
import { getRepositories, type BackupRepository } from '@/repositories';
import { supabase, syncConfigured } from '@/sync/client';
import { runSync } from '@/sync/engine';
import { createSupabaseRemote } from '@/sync/supabaseRemote';

import { reloadAll } from './dataActions';

const SYNC_STATE_KEY = 'syncState';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncStoreState {
  /** Sync is available in this build (Supabase env vars present). */
  configured: boolean;
  userId: string | null;
  email: string | null;
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  init(): Promise<void>;
  /** Returns an error message, or null on success. */
  signIn(email: string, password: string): Promise<string | null>;
  /** Returns an error message, 'confirm' when the e-mail must be confirmed, or null. */
  signUp(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Pushes local changes and pulls remote ones. Safe to call often (runs one at a time). */
  syncNow(): Promise<void>;
  /** Deletes the user's rows in the cloud (used by "delete all data"). */
  deleteCloudData(): Promise<void>;
  /** Deletes the account and its cloud data. Local data stays on the device. */
  deleteAccount(): Promise<void>;
}

async function loadSyncState(): Promise<SyncState> {
  return (await getRepositories().settings.get<SyncState>(SYNC_STATE_KEY)) ?? INITIAL_SYNC_STATE;
}

async function saveSyncState(state: SyncState | null): Promise<void> {
  await getRepositories().settings.set(SYNC_STATE_KEY, state ?? INITIAL_SYNC_STATE);
}

let running: Promise<void> | null = null;
let again = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function stopRetrying(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  failures = 0;
}

/**
 * Sync state for the signed-in account. The first sync of this device with an account (or with
 * another account than last time) queues every local row, so that account gets all of it.
 * States saved by the previous engine (cursors but no account) keep going as they were: their
 * unsent changes were queued by migration 0005.
 */
async function accountState(backup: BackupRepository, userId: string): Promise<SyncState> {
  const state = await loadSyncState();
  if (state.userId === userId) return state;
  const legacy = state.userId === undefined && Object.keys(state.cursors).length > 0;
  if (legacy) return { ...state, userId };
  await backup.enqueueAll();
  const fresh: SyncState = { userId, cursors: {} };
  await saveSyncState(fresh);
  return fresh;
}

export const useSyncStore = create<SyncStoreState>()((set, get) => {
  const remote = () => {
    const { userId } = get();
    if (!supabase || !userId) throw new Error('Not signed in');
    return createSupabaseRemote(supabase, userId);
  };

  return {
    configured: syncConfigured,
    userId: null,
    email: null,
    status: 'idle',
    lastSyncAt: null,
    error: null,

    async init() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      set({ userId: data.session?.user.id ?? null, email: data.session?.user.email ?? null });
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ userId: session?.user.id ?? null, email: session?.user.email ?? null });
      });
    },

    async signIn(email, password) {
      if (!supabase) return 'Sincronização indisponível.';
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return authErrorMessage(error.message);
      set({ userId: data.user.id, email: data.user.email ?? email.trim() });
      await get().syncNow();
      return null;
    },

    async signUp(email, password) {
      if (!supabase) return 'Sincronização indisponível.';
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return authErrorMessage(error.message);
      if (!data.session) return 'confirm';
      set({ userId: data.session.user.id, email: data.session.user.email ?? email.trim() });
      await get().syncNow();
      return null;
    },

    async signOut() {
      stopRetrying();
      await supabase?.auth.signOut();
      set({ userId: null, email: null, status: 'idle', lastSyncAt: null, error: null });
    },

    syncNow() {
      const userId = get().userId;
      if (!supabase || !userId) return Promise.resolve();
      if (running) {
        // Changes made during this round are pushed by another one right after it.
        again = true;
        return running;
      }
      running = (async () => {
        set({ status: 'syncing', error: null });
        try {
          const { backup } = getRepositories();
          const state = await accountState(backup, userId);
          const result = await runSync(backup, remote(), state);
          await saveSyncState(result.state);
          if (result.applied.inserted + result.applied.updated > 0) await reloadAll();
          stopRetrying();
          set({ status: 'idle', lastSyncAt: new Date().toISOString() });
        } catch (error) {
          console.error('Sync failed', error);
          set({
            status: 'error',
            error: authErrorMessage(error instanceof Error ? error.message : String(error)),
          });
          // Offline, server down…: try again later, backing off (2 s, 4 s, 8 s… up to 5 min).
          retryTimer = setTimeout(() => void get().syncNow(), retryDelayMs(failures));
          failures += 1;
        } finally {
          running = null;
          if (again) {
            again = false;
            void get().syncNow();
          }
        }
      })();
      return running;
    },

    async deleteCloudData() {
      await remote().deleteAll();
      await saveSyncState(null);
    },

    async deleteAccount() {
      if (!supabase) return;
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
      await get().signOut();
    },
  };
});
