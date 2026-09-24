import type { HabitDraft } from '@/core/habits/types';
import { openTestDatabase } from '@/db/testing';
import { getRepositories, setRepositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';
import type { RemoteStore } from '@/sync/engine';
import { createFakeRemote } from '@/sync/testing';

import { useSyncStore } from './syncStore';

// Sign-out cancels reminders; the real module warns about Expo Go push on import.
jest.mock('@/lib/notifications', () => ({ cancelAllReminders: jest.fn(async () => undefined) }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});
jest.mock('@/sync/client', () => ({ supabase: { auth: {} }, syncConfigured: true }));
jest.mock('@/lib/authStorage', () => ({ authStorage: { removeItem: async () => undefined } }));
let mockRemote: ReturnType<typeof createFakeRemote>;
const mockNet = { failures: 0, calls: 0 };
jest.mock('@/sync/supabaseRemote', () => ({
  createSupabaseRemote: (): RemoteStore => ({
    upsert: async (table, rows) => {
      mockNet.calls += 1;
      if (mockNet.failures > 0) {
        mockNet.failures -= 1;
        throw new Error('Failed to fetch');
      }
      return mockRemote.upsert(table, rows);
    },
    pull: (...args) => mockRemote.pull(...args),
    deleteAll: () => mockRemote.deleteAll(),
  }),
}));

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

beforeEach(async () => {
  mockRemote = createFakeRemote();
  mockNet.failures = 0;
  mockNet.calls = 0;
  setRepositories(createDrizzleRepositories((await openTestDatabase()).db));
  useSyncStore.setState({ userId: 'user-1', status: 'idle', error: null });
});

afterEach(async () => {
  await useSyncStore
    .getState()
    .signOut()
    .catch(() => undefined); // clears retry timers
  jest.useRealTimers();
});

it('retries a failed sync with exponential backoff until it works', async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await getRepositories().habits.create(draft);
  mockNet.failures = 3;

  await useSyncStore.getState().syncNow();
  expect(useSyncStore.getState().status).toBe('error');
  for (const delay of [2_000, 4_000, 8_000]) {
    const before = mockNet.calls;
    await jest.advanceTimersByTimeAsync(delay - 1);
    expect(mockNet.calls).toBe(before); // not yet
    await jest.advanceTimersByTimeAsync(1);
    expect(mockNet.calls).toBe(before + 1);
  }
  expect(useSyncStore.getState().status).toBe('idle');
  expect(mockRemote.rows('habits')).toHaveLength(1);
  // Once it worked, nothing else is scheduled.
  const settled = mockNet.calls;
  await jest.advanceTimersByTimeAsync(10 * 60_000);
  expect(mockNet.calls).toBe(settled);
});

it('sends everything on the first sync with an account', async () => {
  // Data created before signing in (and even before the outbox existed).
  await getRepositories().habits.create(draft);
  await getRepositories().backup.markPushed(Number.MAX_SAFE_INTEGER);
  await useSyncStore.getState().syncNow();
  expect(mockRemote.rows('habits')).toHaveLength(1);
});

it('keeps an account that was already syncing going without a full push', async () => {
  await getRepositories().habits.create(draft);
  await getRepositories().backup.markPushed(Number.MAX_SAFE_INTEGER);
  // State saved by the previous sync engine (no account id, cursors present).
  await getRepositories().settings.set('syncState', {
    lastPushedAt: '2026-09-01T00:00:00.000Z',
    cursors: { habits: '2026-01-01T00:00:00.000001+00:00' },
  });
  await useSyncStore.getState().syncNow();
  expect(mockRemote.rows('habits')).toHaveLength(0);
  expect(await getRepositories().settings.get('syncState')).toMatchObject({ userId: 'user-1' });
});

it('runs once more when asked during a sync, so late changes go up', async () => {
  const first = useSyncStore.getState().syncNow();
  await getRepositories().habits.create(draft);
  const second = useSyncStore.getState().syncNow();
  expect(second).toBe(first);
  await first;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(mockRemote.rows('habits')).toHaveLength(1);
});
