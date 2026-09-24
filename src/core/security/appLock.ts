/**
 * Optional app lock (Face ID / fingerprint / device passcode). Pure rules; the device API lives
 * in `src/lib/localAuth.ts` and the state in `src/stores/appLockStore.ts`.
 */

/** Back within this time after leaving the app (a quick app switch): no need to unlock again. */
export const LOCK_GRACE_MS = 30_000;

/** Should the app ask to be unlocked when it comes back to the foreground? */
export function shouldLockOnReturn(
  enabled: boolean,
  backgroundedAt: number | null,
  now: number,
): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= LOCK_GRACE_MS;
}
