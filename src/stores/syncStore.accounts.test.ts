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
  setRepositories(createDrizzleRepositories((await openTestDatabase()).db));
  await useSyncStore.getState().init();
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
