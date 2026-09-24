import { LOCK_GRACE_MS, shouldLockOnReturn } from './appLock';

describe('shouldLockOnReturn', () => {
  it('locks after the grace period away from the app', () => {
    expect(shouldLockOnReturn(true, 0, LOCK_GRACE_MS)).toBe(true);
    expect(shouldLockOnReturn(true, 0, 10 * 60_000)).toBe(true);
  });

  it('does not lock after a quick app switch', () => {
    expect(shouldLockOnReturn(true, 0, LOCK_GRACE_MS - 1)).toBe(false);
  });

  it('never locks when the lock is off or the app was not in the background', () => {
    expect(shouldLockOnReturn(false, 0, 10 * 60_000)).toBe(false);
    expect(shouldLockOnReturn(true, null, 10 * 60_000)).toBe(false);
  });
});
