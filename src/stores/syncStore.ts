import { create } from 'zustand';

import {
  EMAIL_COOLDOWN_MS,
  authLinkError,
  formatWait,
  parseAuthCallback,
  signInCooldownMs,
  validateNewPassword,
} from '@/core/auth/auth';
import { BACKUP_TABLES } from '@/core/backup/backup';
import {
  INITIAL_SYNC_STATE,
  authErrorMessage,
  pushableRows,
  retryDelayMs,
  type SyncState,
} from '@/core/sync/sync';
import { t } from '@/i18n/i18n';
import { authRedirectUrl } from '@/lib/authLinks';
import { authStorage } from '@/lib/authStorage';
import { isPwnedPassword } from '@/lib/pwnedPasswords';
import { getRepositories, type BackupRepository } from '@/repositories';
import { supabase, syncConfigured } from '@/sync/client';
import { queueMissing, runSync } from '@/sync/engine';
import { createSupabaseRemote } from '@/sync/supabaseRemote';

import { deleteAllData, reloadAll } from './dataActions';
import { logError } from '@/lib/log';

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
  /** Shown on the sign-in form, e.g. when the session expired. */
  notice: string | null;
  init(): Promise<void>;
  /** Returns an error message, or null on success. Throttled after wrong passwords. */
  signIn(email: string, password: string): Promise<string | null>;
  /** Returns an error message, 'confirm' when the e-mail must be confirmed, or null. */
  signUp(email: string, password: string): Promise<string | null>;
  /** Sends a password reset link. Never reveals whether the account exists. */
  requestPasswordReset(email: string): Promise<{ text: string; error: boolean }>;
  /** Finishes an e-mail link (/auth/callback): an error message, or what the link was for. */
  completeAuthLink(url: string): Promise<{ error: string } | { next: 'confirm' | 'reset' }>;
  /** Sets a new password for the signed-in user. Returns an error message, or null. */
  updatePassword(password: string): Promise<string | null>;
  /**
   * Signs out and clears this device: tokens and every local row (they stay in the cloud).
   * Syncs first; when changes still could not be sent, returns their count and does nothing
   * unless `discardPending` (the user accepted losing them).
   */
  signOut(options?: { discardPending?: boolean }): Promise<{ pending: number } | null>;
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
/** Wrong passwords in a row, and until when sign-in is blocked (client-side throttling). */
let signInFailures = 0;
let signInBlockedUntil = 0;
/**
 * When each address last got an e-mail (confirmation, reset). Per address, like the server: a
 * sign-up with one e-mail must not block a sign-up with another.
 */
const lastEmailSentAt = new Map<string, number>();
const emailKey = (email: string) => email.trim().toLowerCase();
/** Set while the user signs out, so that SIGNED_OUT is not taken for an expired session. */
let signingOut = false;

/** Removes the persisted session even when the sign-out request cannot reach the server. */
async function forgetSession(): Promise<void> {
  if (!supabase) return;
  signingOut = true;
  try {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    // supabase-js keeps the stored session when that request fails (offline): drop it here.
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    for (const suffix of ['', '-code-verifier', '-user'])
      await authStorage.removeItem(key + suffix);
  } finally {
    signingOut = false;
  }
}

/** Checks a new password: the rules first, then known data breaches (skipped offline). */
async function newPasswordProblem(password: string, email: string): Promise<string | null> {
  const invalid = validateNewPassword(password, email);
  if (invalid) return invalid;
  if (await isPwnedPassword(password)) {
    return t('Esta senha apareceu em vazamentos de dados. Escolha outra.');
  }
  return null;
}

/** Message while the app must wait before asking for another e-mail to this address. */
function emailWait(email: string): string | null {
  const wait = (lastEmailSentAt.get(emailKey(email)) ?? 0) + EMAIL_COOLDOWN_MS - Date.now();
  return wait > 0
    ? t('Aguarde {seconds} s para pedir outro e-mail.', { seconds: Math.ceil(wait / 1000) })
    : null;
}
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
    notice: null,

    async init() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      set({ userId: data.session?.user.id ?? null, email: data.session?.user.email ?? null });
      supabase.auth.onAuthStateChange((event, session) => {
        // The session ended by itself (refresh token expired or revoked): stop syncing and say
        // so. Local data is untouched; signing in again resumes, pending changes included.
        const expired = event === 'SIGNED_OUT' && !signingOut && get().userId !== null;
        if (expired) stopRetrying();
        set({ userId: session?.user.id ?? null, email: session?.user.email ?? null });
        if (expired) {
          set({
            status: 'idle',
            error: null,
            notice: t(
              'Sua sessão expirou. Entre de novo para voltar a sincronizar — seus dados continuam neste aparelho.',
            ),
          });
        }
      });
    },

    async signIn(email, password) {
      if (!supabase) return t('Sincronização indisponível.');
      const wait = signInBlockedUntil - Date.now();
      if (wait > 0) return formatWait(wait);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          signInFailures += 1;
          signInBlockedUntil = Date.now() + signInCooldownMs(signInFailures);
        }
        return authErrorMessage(error.message);
      }
      signInFailures = 0;
      signInBlockedUntil = 0;
      set({ userId: data.user.id, email: data.user.email ?? email.trim(), notice: null });
      await get().syncNow();
      return null;
    },

    async signUp(email, password) {
      if (!supabase) return t('Sincronização indisponível.');
      const problem = emailWait(email) ?? (await newPasswordProblem(password, email));
      if (problem) return problem;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectUrl('confirm') },
      });
      if (error) return authErrorMessage(error.message);
      lastEmailSentAt.set(emailKey(email), Date.now());
      if (!data.session) return 'confirm';
      set({ userId: data.session.user.id, email: data.session.user.email ?? email.trim() });
      await get().syncNow();
      return null;
    },

    async requestPasswordReset(email) {
      if (!supabase) return { text: t('Sincronização indisponível.'), error: true };
      const wait = emailWait(email);
      if (wait) return { text: wait, error: true };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl('reset'),
      });
      if (error) return { text: authErrorMessage(error.message), error: true };
      lastEmailSentAt.set(emailKey(email), Date.now());
      return {
        text: t(
          'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Abra-o neste aparelho.',
        ),
        error: false,
      };
    },

    async completeAuthLink(url) {
      if (!supabase) return { error: t('Sincronização indisponível.') };
      const link = parseAuthCallback(url);
      if (link.error) return { error: link.error };
      if (!link.code) return { error: authLinkError('missing') };
      const { data, error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) return { error: authLinkError(error.code ?? error.message) };
      set({ userId: data.user.id, email: data.user.email ?? null, notice: null });
      void get().syncNow();
      return { next: link.next };
    },

    async updatePassword(password) {
      if (!supabase) return t('Sincronização indisponível.');
      const problem = await newPasswordProblem(password, get().email ?? '');
      if (problem) return problem;
      const { error } = await supabase.auth.updateUser({ password });
      return error ? authErrorMessage(error.message) : null;
    },

    async signOut(options = {}) {
      if (get().userId) {
        await get().syncNow();
        const { tables } = await getRepositories().backup.pendingChanges();
        const pending = BACKUP_TABLES.reduce(
          (sum, table) => sum + pushableRows(table, tables[table]).length,
          0,
        );
        if (pending > 0 && !options.discardPending) return { pending };
      }
      stopRetrying();
      await forgetSession();
      set({
        userId: null,
        email: null,
        status: 'idle',
        lastSyncAt: null,
        error: null,
        notice: null,
      });
      // The account's data leaves this device (it stays in the cloud).
      await deleteAllData();
      return null;
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
          if (!result.state.verified) {
            // Once per device and account: send what the cloud never got (see queueMissing).
            if ((await queueMissing(backup, remote())) > 0) again = true;
            result.state.verified = true;
          }
          await saveSyncState(result.state);
          if (result.applied.inserted + result.applied.updated > 0) await reloadAll();
          stopRetrying();
          set({ status: 'idle', lastSyncAt: new Date().toISOString() });
        } catch (error) {
          logError('Sync failed', error);
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
      // The account is gone from the server; local data stays on this device (as the UI says).
      stopRetrying();
      await forgetSession();
      await saveSyncState(null);
      set({
        userId: null,
        email: null,
        status: 'idle',
        lastSyncAt: null,
        error: null,
        notice: null,
      });
    },
  };
});
