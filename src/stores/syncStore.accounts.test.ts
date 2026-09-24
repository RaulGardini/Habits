import type { HabitDraft } from '@/core/habits/types';
import { openTestDatabase } from '@/db/testing';
import { setLanguage } from '@/i18n/i18n';
import { getRepositories, setRepositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import { supabase } from '@/sync/client';
import type { RemoteStore } from '@/sync/engine';

import { useHabitsStore } from './habitsStore';
import { useSyncStore } from './syncStore';

jest.mock('@/lib/notifications', () => ({ cancelAllReminders: jest.fn(async () => undefined) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});
jest.mock('@/sync/client', () => ({
  supabase: {
    auth: {
      storageKey: 'sb-test-auth-token',
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(async () => ({ error: null })),
    },
  },
  syncConfigured: true,
}));
jest.mock('@/lib/authStorage', () => ({ authStorage: { removeItem: async () => undefined } }));
// One cloud per account, like RLS on the real project.
const mockClouds = new Map<string, RemoteStore>();
jest.mock('@/sync/supabaseRemote', () => ({
  createSupabaseRemote: (_client: unknown, userId: string): RemoteStore => {
    if (!mockClouds.has(userId)) {
      const { createFakeRemote: create } =
        jest.requireActual<typeof import('@/sync/testing')>('@/sync/testing');
      mockClouds.set(userId, create());
    }
    return mockClouds.get(userId)!;
  },
}));

const auth = supabase!.auth as unknown as { signInWithPassword: jest.Mock };
const draft = (name: string): HabitDraft => ({
  name,
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
});

async function signIn(id: string) {
  auth.signInWithPassword.mockResolvedValueOnce({
    data: { user: { id, email: `${id}@example.com` } },
    error: null,
  });
  expect(await useSyncStore.getState().signIn(`${id}@example.com`, 'password')).toBeNull();
}
const habitNames = async () => (await getRepositories().habits.list()).map((h) => h.name).sort();

beforeAll(async () => {
  setLanguage('pt');
  await useSyncStore.getState().init();
});

// Every test starts on a new, signed-out device.
beforeEach(async () => {
  setRepositories(createDrizzleRepositories((await openTestDatabase()).db));
  useSyncStore.setState({ userId: null, email: null, status: 'idle', firstSync: null });
});

it('brings every habit back after switching accounts on the same device', async () => {
  // Phone: the owner's habits reach the cloud.
  await signIn('owner');
  await getRepositories().habits.create(draft('Ler'));
  await getRepositories().habits.create(draft('Correr'));
  await useSyncStore.getState().syncNow();

  // Web: sign out, use a test account for a while, sign out again.
  expect(await useSyncStore.getState().signOut()).toBeNull();
  expect(await habitNames()).toEqual([]);
  await signIn('test1');
  await getRepositories().habits.create(draft('Teste'));
  await useSyncStore.getState().syncNow();
  expect(await useSyncStore.getState().signOut()).toBeNull();

  // Back to the owner's account: everything comes back, nothing from the test account.
  await signIn('owner');
  expect(await habitNames()).toEqual(['Correr', 'Ler']);
  expect(
    useHabitsStore
      .getState()
      .habits.map((h) => h.name)
      .sort(),
  ).toEqual(['Correr', 'Ler']);
});

it('a device updated from an older version sends, once, what the cloud never got', async () => {
  await signIn('phone-owner');
  await getRepositories().habits.create(draft('Ler'));
  await getRepositories().habits.create(draft('Correr'));
  // As before this version: rows marked as pushed that never reached the cloud, and a sync
  // state without the one-time check.
  const { upTo } = await getRepositories().backup.pendingChanges();
  await getRepositories().backup.markPushed(upTo);
  await getRepositories().settings.set('syncState', { userId: 'phone-owner', cursors: {} });

  await useSyncStore.getState().syncNow();
  await useSyncStore.getState().syncNow(); // the round that sends what the check queued
  const cloud = mockClouds.get('phone-owner')!;
  expect((await cloud.keys('habits')).length).toBe(2);
  expect(
    (await getRepositories().settings.get<{ verified?: boolean }>('syncState'))?.verified,
  ).toBe(true);
});

describe('first sign-in on a device', () => {
  /** An account whose cloud already has "Ler" (created on another device). */
  async function existingAccount(id: string) {
    await signIn(id);
    await getRepositories().habits.create(draft('Ler'));
    await useSyncStore.getState().syncNow();
    expect(await useSyncStore.getState().signOut()).toBeNull(); // this device is empty again
  }

  it('a new account gets what was created before signing up', async () => {
    await getRepositories().habits.create(draft('Beber água'));
    await signIn('new-account');
    expect(useSyncStore.getState().firstSync).toBeNull();
    expect((await mockClouds.get('new-account')!.keys('habits')).length).toBe(1);
    expect(await useSyncStore.getState().signOut()).toBeNull();
  });

  it("an empty device shows the account's data, and its preferences do not override it", async () => {
    await existingAccount('with-data');
    await signIn('with-data');
    await getRepositories().settings.set('themePreference', 'dark');
    await useSyncStore.getState().syncNow();
    expect(await useSyncStore.getState().signOut()).toBeNull();

    // Signed out, the user changes the theme only, then signs in again.
    await getRepositories().settings.set('themePreference', 'light');
    await signIn('with-data');
    expect(useSyncStore.getState().firstSync).toBeNull();
    expect(await habitNames()).toEqual(['Ler']);
    expect(await getRepositories().settings.get('themePreference')).toBe('dark');
    expect(await useSyncStore.getState().signOut()).toBeNull();
  });

  it('asks when both have data; "use the account\'s" drops this device\'s', async () => {
    await existingAccount('ask-account');
    await getRepositories().habits.create(draft('Criado offline'));
    await signIn('ask-account');
    expect(useSyncStore.getState().firstSync).toEqual({ habits: 1, other: 0 });
    // Nothing moved while waiting: the cloud still has only the account's habit.
    await useSyncStore.getState().syncNow();
    expect((await mockClouds.get('ask-account')!.keys('habits')).length).toBe(1);

    await useSyncStore.getState().resolveFirstSync('account');
    expect(useSyncStore.getState().firstSync).toBeNull();
    expect(await habitNames()).toEqual(['Ler']);
    expect((await mockClouds.get('ask-account')!.keys('habits')).length).toBe(1);
    expect(await useSyncStore.getState().signOut()).toBeNull();
  });

  it('asks when both have data; "add them" keeps both', async () => {
    await existingAccount('ask-merge');
    await getRepositories().habits.create(draft('Criado offline'));
    await signIn('ask-merge');
    await useSyncStore.getState().resolveFirstSync('merge');
    expect(await habitNames()).toEqual(['Criado offline', 'Ler']);
    expect((await mockClouds.get('ask-merge')!.keys('habits')).length).toBe(2);
    expect(await useSyncStore.getState().signOut()).toBeNull();
  });
});
