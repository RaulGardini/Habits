// The previous versions kept the session in expo-sqlite's localStorage (plain text): read once
// to move it into the secure store, then deleted.
import 'expo-sqlite/localStorage/install';

import * as SecureStore from 'expo-secure-store';

/** iOS historically rejects Keychain values above ~2 KB; a Supabase session is bigger. */
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.chunks`;
const partKey = (key: string, index: number) => `${key}.${index}`;

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return parts.length > 0 ? parts : [''];
}

async function readChunks(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  if (!Number.isInteger(count) || count <= 0) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(partKey(key, i))),
  );
  return parts.some((part) => part === null) ? null : parts.join('');
}

async function deleteChunks(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(partKey(key, i));
  await SecureStore.deleteItemAsync(countKey(key));
}

async function writeChunks(key: string, value: string): Promise<void> {
  const parts = splitIntoChunks(value);
  const previous = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
  for (const [i, part] of parts.entries()) await SecureStore.setItemAsync(partKey(key, i), part);
  await SecureStore.setItemAsync(countKey(key), String(parts.length));
  for (let i = parts.length; i < previous; i++) await SecureStore.deleteItemAsync(partKey(key, i));
}

/**
 * Supabase auth storage (session, refresh token, PKCE verifier) in the iOS Keychain / Android
 * Keystore via expo-secure-store — never in plain-text storage. Values are split in chunks.
 * Web has no equivalent: see `authStorage.web.ts`.
 */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = await readChunks(key);
    if (value !== null) return value;
    const legacy = globalThis.localStorage?.getItem(key) ?? null;
    if (legacy !== null) {
      await writeChunks(key, legacy);
      globalThis.localStorage.removeItem(key);
    }
    return legacy;
  },

  async setItem(key: string, value: string): Promise<void> {
    await writeChunks(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await deleteChunks(key);
    globalThis.localStorage?.removeItem(key);
  },
};
