import { Platform } from 'react-native';

/**
 * Load test on web (dev server, or a production export built with `EXPO_PUBLIC_LOADTEST=1` to
 * measure real performance): opening the app with `?loadtest` in the URL switches to a separate
 * database filled with 40 habits × 3 years of fake data (see `src/db/loadTest.ts`), with cloud
 * sync disabled so that data never reaches the user's account. Returns the database name, or
 * null outside that mode.
 */
export function loadTestDatabaseName(): string | null {
  const enabled = __DEV__ || process.env.EXPO_PUBLIC_LOADTEST === '1';
  if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).has('loadtest') ? 'habits-loadtest.db' : null;
}
