import { getLanguage } from '@/i18n/i18n';

/** Public site (EAS Hosting): support page, privacy policy, account deletion. */
export const SITE_URL = 'https://habits-raul.expo.app';

/** Support page (contact + common questions) in the app's language. */
export function supportUrl(): string {
  return `${SITE_URL}/${getLanguage() === 'en' ? 'support' : 'suporte'}.html`;
}
