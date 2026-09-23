import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { authStorage } from '@/lib/authStorage';
import { loadTestDatabaseName } from '@/lib/loadTest';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase client, or null when sync is not configured (no env vars): the app then works
 * 100% offline and hides account features.
 */
export const supabase: SupabaseClient | null =
  // Never sync the fake data of the dev load-test database.
  url && key && !loadTestDatabaseName()
    ? createClient(url, key, {
        auth: {
          // Keychain / Keystore on the phone (never plain text); localStorage on the web.
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          // E-mail links (confirmation, password reset) come back with a one-time `code` that
          // only this device can exchange (PKCE): a stolen link is useless elsewhere.
          flowType: 'pkce',
          // Handled by the /auth/callback route.
          detectSessionInUrl: false,
        },
      })
    : null;

export const syncConfigured = supabase !== null;

// Only refresh tokens while the app is in the foreground (recommended by Supabase).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
