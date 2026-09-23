import * as Linking from 'expo-linking';

/**
 * Where Supabase e-mail links (account confirmation, password reset) send the user back:
 * the `/auth/callback` route, through the app's own scheme — `habits://auth/callback` in store
 * builds, `exp://…/--/auth/callback` in Expo Go, `https://<site>/auth/callback` on the web.
 * Every one of these must be in the project's Redirect URLs allow list (docs/SUPABASE.md);
 * Supabase refuses any other destination.
 */
export function authRedirectUrl(next: 'confirm' | 'reset'): string {
  return Linking.createURL('auth/callback', { queryParams: { next } });
}
