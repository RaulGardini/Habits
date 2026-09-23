import * as SecureStore from 'expo-secure-store';

import { authStorage, splitIntoChunks } from './authStorage';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      if (!/^[\w.-]+$/.test(key)) throw new Error(`invalid key ${key}`);
      if (value.length > 2048) throw new Error('value too large for the Keychain');
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const legacy = new Map<string, string>();
const KEY = 'sb-jjmgidotiujptltxpfls-auth-token';
const session = JSON.stringify({ access_token: 'a'.repeat(1200), refresh_token: 'r'.repeat(900) });

beforeAll(() => {
  globalThis.localStorage = {
    getItem: (key: string) => legacy.get(key) ?? null,
    setItem: (key: string, value: string) => void legacy.set(key, value),
    removeItem: (key: string) => void legacy.delete(key),
  } as Storage;
});
beforeEach(() => {
  store.clear();
  legacy.clear();
});

it('splits values into Keychain-sized chunks', () => {
  expect(splitIntoChunks('abcde', 2)).toEqual(['ab', 'cd', 'e']);
  expect(splitIntoChunks('', 2)).toEqual(['']);
});

it('stores a session bigger than the Keychain limit and reads it back', async () => {
  expect(session.length).toBeGreaterThan(2048);
  await authStorage.setItem(KEY, session);
  expect(await authStorage.getItem(KEY)).toBe(session);
  expect(store.get(`${KEY}.chunks`)).toBe('2');
});

it('drops leftover chunks when the session shrinks, and removes everything', async () => {
  await authStorage.setItem(KEY, session);
  await authStorage.setItem(KEY, 'short');
  expect(await authStorage.getItem(KEY)).toBe('short');
  expect([...store.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.chunks`]);
  await authStorage.removeItem(KEY);
  expect(store.size).toBe(0);
  expect(await authStorage.getItem(KEY)).toBeNull();
});

it('moves a session saved in plain text by older versions into the secure store', async () => {
  legacy.set(KEY, session);
  expect(await authStorage.getItem(KEY)).toBe(session); // still signed in
  expect(legacy.has(KEY)).toBe(false); // plain-text copy gone
  expect(await authStorage.getItem(KEY)).toBe(session);
});

it('treats a half-written session as missing instead of returning garbage', async () => {
  await authStorage.setItem(KEY, session);
  store.delete(`${KEY}.1`);
  expect(await authStorage.getItem(KEY)).toBeNull();
});
