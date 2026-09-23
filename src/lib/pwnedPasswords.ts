import * as Crypto from 'expo-crypto';

import { isSuffixInRange } from '@/core/auth/auth';

const TIMEOUT_MS = 5_000;

/**
 * Has this password appeared in known data breaches? Uses the free HaveIBeenPwned "range" API
 * with k-anonymity: only the first 5 characters of the password's SHA-1 leave the device (plus
 * padding, so the answer size reveals nothing). The free Supabase plan cannot block leaked
 * passwords on the server, so the app checks on sign-up and password change.
 *
 * Returns null when the check could not run (offline, timeout): the caller lets it through.
 */
export async function isPwnedPassword(password: string): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const hash = (
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, password)
    ).toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return isSuffixInRange(await response.text(), hash.slice(5));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
