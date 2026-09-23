/**
 * Web: browsers have no Keychain; the Supabase session lives in `localStorage` of this origin
 * (the same place supabase-js uses by default). Keep this file in sync with `authStorage.ts`.
 */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(key);
  },
};
