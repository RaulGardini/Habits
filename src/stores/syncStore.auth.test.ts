import type { HabitDraft } from '@/core/habits/types';
import { openTestDatabase } from '@/db/testing';
import { setLanguage } from '@/i18n/i18n';
import { isPwnedPassword } from '@/lib/pwnedPasswords';
import { getRepositories, setRepositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import { supabase } from '@/sync/client';
import type { RemoteStore } from '@/sync/engine';
import { createFakeRemote } from '@/sync/testing';

import { useSyncStore } from './syncStore';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});
jest.mock('@/sync/client', () => {
  const listeners: ((event: string, session: unknown) => void)[] = [];
  const auth = {
    storageKey: 'sb-test-auth-token',
    listeners,
    getSession: jest.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: jest.fn((listener: (event: string, session: unknown) => void) => {
      listeners.push(listener);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    exchangeCodeForSession: jest.fn(),
    updateUser: jest.fn(async () => ({ error: null })),
    signOut: jest.fn(async () => ({ error: null })),
  };
  return { supabase: { auth, rpc: jest.fn(async () => ({ error: null })) }, syncConfigured: true };
});
jest.mock('@/lib/authStorage', () => ({
  authStorage: { removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/lib/pwnedPasswords', () => ({ isPwnedPassword: jest.fn(async () => false) }));
jest.mock('@/lib/authLinks', () => ({
  authRedirectUrl: (next: string) => `habits://auth/callback?next=${next}`,
}));
const mockNet = { online: true, remote: null as ReturnType<typeof createFakeRemote> | null };
jest.mock('@/sync/supabaseRemote', () => ({
  createSupabaseRemote: (): RemoteStore => ({
    upsert: async (table, rows) => {
      if (!mockNet.online) throw new Error('Failed to fetch');
      return mockNet.remote!.upsert(table, rows);
    },
    pull: async (...args) => {
      if (!mockNet.online) throw new Error('Failed to fetch');
      return mockNet.remote!.pull(...args);
    },
    deleteAll: () => mockNet.remote!.deleteAll(),
  }),
}));

type MockAuth = Record<
  | 'signInWithPassword'
  | 'signUp'
  | 'resetPasswordForEmail'
  | 'exchangeCodeForSession'
  | 'updateUser'
  | 'signOut',
  jest.Mock
> & { listeners: ((event: string, session: unknown) => void)[] };
const auth = supabase!.auth as unknown as MockAuth;
const { authStorage } = jest.requireMock('@/lib/authStorage') as {
  authStorage: { removeItem: jest.Mock };
};
const user = { id: 'user-1', email: 'raul@example.com' };
const draft: HabitDraft = {
  name: 'Ler',
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
};

beforeAll(async () => {
  await useSyncStore.getState().init();
});

/** Each test starts an hour after the previous one: no e-mail/sign-in limits carried over. */
let hour = 0;

beforeEach(async () => {
  hour += 1;
  jest.useFakeTimers({
    now: new Date(Date.UTC(2026, 8, 23, hour)),
    doNotFake: ['nextTick', 'setImmediate'],
  });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockNet.online = true;
  mockNet.remote = createFakeRemote();
  setRepositories(createDrizzleRepositories((await openTestDatabase()).db));
  useSyncStore.setState({ userId: null, email: null, status: 'idle', error: null, notice: null });
  // Signing out reloads the settings, which picks the device language (English under Jest).
  setLanguage('pt');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('sign in', () => {
  it('blocks sign-in for a while after 3 wrong passwords, without asking the server', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    for (let i = 0; i < 3; i++) {
      expect(await useSyncStore.getState().signIn(user.email, 'wrong')).toContain('incorretos');
    }
    expect(await useSyncStore.getState().signIn(user.email, 'right?')).toContain('30 s');
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(30_000);
    auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
    expect(await useSyncStore.getState().signIn(user.email, 'right')).toBeNull();
    expect(useSyncStore.getState().userId).toBe('user-1');
  });
});

describe('sign up', () => {
  it('refuses weak and leaked passwords before calling the server', async () => {
    expect(await useSyncStore.getState().signUp('new@example.com', '123')).toContain('8');
    jest.mocked(isPwnedPassword).mockResolvedValueOnce(true);
    expect(await useSyncStore.getState().signUp('new@example.com', 'password123')).toContain(
      'vazamentos',
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('asks for e-mail confirmation through the app link (PKCE)', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(await useSyncStore.getState().signUp('new@example.com', 'uma frase longa')).toBe(
      'confirm',
    );
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'uma frase longa',
      options: { emailRedirectTo: 'habits://auth/callback?next=confirm' },
    });
    // Another e-mail to the same address within a minute is refused by the app…
    expect((await useSyncStore.getState().requestPasswordReset('New@Example.com ')).text).toBe(
      'Aguarde 60 s para pedir outro e-mail.',
    );
    // …but another address is not blocked.
    auth.signUp.mockClear();
    expect(await useSyncStore.getState().signUp('other@example.com', 'uma frase longa')).toBe(
      'confirm',
    );
    expect(auth.signUp).toHaveBeenCalledTimes(1);
  });
});

describe('password reset', () => {
  it('sends the link without telling whether the account exists', async () => {
    const result = await useSyncStore.getState().requestPasswordReset('ghost@example.com');
    expect(result).toEqual({ text: expect.stringContaining('Se existir'), error: false });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ghost@example.com', {
      redirectTo: 'habits://auth/callback?next=reset',
    });
  });

  it('opens the new password screen from a valid link and saves the new password', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });
    expect(
      await useSyncStore.getState().completeAuthLink('auth/callback?next=reset&code=one-time'),
    ).toEqual({ next: 'reset' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time');
    expect(useSyncStore.getState().email).toBe(user.email);

    expect(await useSyncStore.getState().updatePassword('outra frase longa')).toBeNull();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'outra frase longa' });
  });

  it('explains an expired link and one opened on another device', async () => {
    const expired = await useSyncStore
      .getState()
      .completeAuthLink('auth/callback?next=reset&error=access_denied&error_code=otp_expired');
    expect(expired).toEqual({ error: expect.stringContaining('expirou') });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();

    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { code: 'flow_state_not_found', message: 'invalid flow state' },
    });
    const otherDevice = await useSyncStore
      .getState()
      .completeAuthLink('auth/callback?next=reset&code=abc');
    expect(otherDevice).toEqual({ error: expect.stringContaining('mesmo aparelho') });
    expect(useSyncStore.getState().userId).toBeNull();
  });
});

describe('sign out', () => {
  beforeEach(() => {
    useSyncStore.setState({ userId: user.id, email: user.email });
  });

  it('syncs, then removes the tokens and the local data', async () => {
    await getRepositories().habits.create(draft);
    expect(await useSyncStore.getState().signOut()).toBeNull();
    expect(mockNet.remote!.rows('habits')).toHaveLength(1); // saved in the cloud first
    expect(await getRepositories().habits.list()).toEqual([]);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(authStorage.removeItem).toHaveBeenCalledWith('sb-test-auth-token');
    expect(useSyncStore.getState()).toMatchObject({ userId: null, email: null });
  });

  it('keeps everything when changes could not be sent, unless the user accepts losing them', async () => {
    await getRepositories().habits.create(draft);
    mockNet.online = false;
    expect(await useSyncStore.getState().signOut()).toEqual({ pending: 1 });
    expect(await getRepositories().habits.list()).toHaveLength(1);
    expect(useSyncStore.getState().userId).toBe(user.id);

    // Offline, and the sign-out request itself fails: tokens are still removed.
    auth.signOut.mockRejectedValueOnce(new Error('Failed to fetch'));
    expect(await useSyncStore.getState().signOut({ discardPending: true })).toBeNull();
    expect(await getRepositories().habits.list()).toEqual([]);
    expect(authStorage.removeItem).toHaveBeenCalledWith('sb-test-auth-token');
    expect(useSyncStore.getState().userId).toBeNull();
  });
});

describe('session expired while using the app', () => {
  it('stops syncing, says so, and keeps every local row', async () => {
    useSyncStore.setState({ userId: user.id, email: user.email });
    await getRepositories().habits.create(draft);
    for (const listener of auth.listeners) listener('SIGNED_OUT', null);

    expect(useSyncStore.getState()).toMatchObject({ userId: null, email: null });
    expect(useSyncStore.getState().notice).toContain('sessão expirou');
    expect(await getRepositories().habits.list()).toHaveLength(1);
    // Nothing tries to sync with the dead session.
    await useSyncStore.getState().syncNow();
    expect(mockNet.remote!.rows('habits')).toHaveLength(0);
  });

  it('does not show the notice when the user signed out on purpose', async () => {
    useSyncStore.setState({ userId: user.id, email: user.email });
    auth.signOut.mockImplementationOnce(async () => {
      for (const listener of auth.listeners) listener('SIGNED_OUT', null);
      return { error: null };
    });
    await useSyncStore.getState().signOut();
    expect(useSyncStore.getState().notice).toBeNull();
  });
});

describe('delete account', () => {
  it('deletes the account on the server and keeps the local data', async () => {
    useSyncStore.setState({ userId: user.id, email: user.email });
    await getRepositories().habits.create(draft);
    await useSyncStore.getState().deleteAccount();
    expect(supabase!.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(authStorage.removeItem).toHaveBeenCalledWith('sb-test-auth-token');
    expect(useSyncStore.getState().userId).toBeNull();
    expect(await getRepositories().habits.list()).toHaveLength(1);
  });
});
