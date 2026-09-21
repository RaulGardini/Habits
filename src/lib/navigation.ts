import { router } from 'expo-router';

/** Goes back, or to the home screen when there is no history (e.g. a deep link on web). */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
