import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';

import { EN } from './en';

export type Language = 'pt' | 'en';

export const LANGUAGES: readonly Language[] = ['pt', 'en'];

/**
 * Translation keys are the pt-BR strings themselves (gettext style): `t('Concluir')`. In
 * Portuguese the key is returned as is, so a missing translation degrades to pt-BR instead of
 * showing an identifier. `{name}` placeholders are replaced from `params`.
 */
export type TranslationKey = string;

// Module-level so pure helpers (dates, reminders, labels) can translate without React.
let current: Language = 'pt';

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  current = language;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'pt' || value === 'en';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translated = current === 'en' ? (EN[key] ?? key) : key;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Formats a date with the pattern of the current language (patterns differ: "d 'de' MMM"). */
export function formatWith(date: Date, pt: string, en: string): string {
  return format(date, current === 'en' ? en : pt, { locale: dateLocale() });
}

/** date-fns locale matching the current language (dates, month and weekday names). */
export function dateLocale(): Locale {
  return current === 'en' ? enUS : ptBR;
}
