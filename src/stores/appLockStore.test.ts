import { authenticate, canLockApp } from '@/lib/localAuth';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { APP_LOCK_KEY, useAppLockStore } from './appLockStore';

jest.mock('@/lib/localAuth', () => ({
  canLockApp: jest.fn(async () => true),
  authenticate: jest.fn(async () => true),
}));

beforeEach(() => {
  jest.clearAllMocks();
  setRepositories(createMemoryRepositories());
  useAppLockStore.setState({ available: false, enabled: false, locked: false });
});

it('starts locked on a cold start when the lock is on', async () => {
  await getRepositories().settings.set(APP_LOCK_KEY, true);
  await useAppLockStore.getState().load();
  expect(useAppLockStore.getState()).toMatchObject({
    available: true,
    enabled: true,
    locked: true,
  });
});

it('ignores a stored lock on a device that cannot authenticate', async () => {
  jest.mocked(canLockApp).mockResolvedValueOnce(false);
  await getRepositories().settings.set(APP_LOCK_KEY, true);
  await useAppLockStore.getState().load();
  expect(useAppLockStore.getState()).toMatchObject({ enabled: false, locked: false });
});

it('turns on only after the user authenticates (nobody locks themselves out)', async () => {
  jest.mocked(authenticate).mockResolvedValueOnce(false);
  expect(await useAppLockStore.getState().setEnabled(true)).toBe(false);
  expect(useAppLockStore.getState().enabled).toBe(false);
  expect(await getRepositories().settings.get(APP_LOCK_KEY)).toBeNull();

  expect(await useAppLockStore.getState().setEnabled(true)).toBe(true);
  expect(useAppLockStore.getState().enabled).toBe(true);
  expect(await getRepositories().settings.get(APP_LOCK_KEY)).toBe(true);
});

it('locks again after 30 s away, not after a quick app switch', () => {
  useAppLockStore.setState({ enabled: true });
  const { onAppStateChange } = useAppLockStore.getState();
  onAppStateChange('background', 0);
  onAppStateChange('active', 10_000);
  expect(useAppLockStore.getState().locked).toBe(false);
  // The Face ID prompt only makes the app "inactive": that never counts as leaving.
  onAppStateChange('inactive', 20_000);
  onAppStateChange('active', 60_000);
  expect(useAppLockStore.getState().locked).toBe(false);
  onAppStateChange('background', 100_000);
  onAppStateChange('active', 131_000);
  expect(useAppLockStore.getState().locked).toBe(true);
});

it('unlocks with one system prompt even when asked twice', async () => {
  useAppLockStore.setState({ enabled: true, locked: true });
  const [a, b] = await Promise.all([
    useAppLockStore.getState().unlock(),
    useAppLockStore.getState().unlock(),
  ]);
  expect([a, b]).toEqual([true, true]);
  expect(authenticate).toHaveBeenCalledTimes(1);
  expect(useAppLockStore.getState().locked).toBe(false);
});

it('stays locked when the user cancels', async () => {
  useAppLockStore.setState({ enabled: true, locked: true });
  jest.mocked(authenticate).mockResolvedValueOnce(false);
  expect(await useAppLockStore.getState().unlock()).toBe(false);
  expect(useAppLockStore.getState().locked).toBe(true);
});
