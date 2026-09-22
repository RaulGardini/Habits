import { addDays, format, isValid, parse } from 'date-fns';
import { formatWith, t } from '@/i18n/i18n';

/**
 * A calendar day in the user's local time zone, formatted as `YYYY-MM-DD`.
 * Stored as text (never as a timestamp) so a day never shifts across time zones.
 * Lexicographic order equals chronological order.
 */
export type LocalDate = string;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalDate(date: Date): LocalDate {
  return format(date, 'yyyy-MM-dd');
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function isLocalDate(value: string): value is LocalDate {
  return LOCAL_DATE_PATTERN.test(value) && isValid(parse(value, 'yyyy-MM-dd', new Date()));
}

/** Returns a Date at local midnight of the given day. */
export function parseLocalDate(value: LocalDate): Date {
  if (!isLocalDate(value)) throw new Error(`Invalid local date: "${value}"`);
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysLocal(value: LocalDate, amount: number): LocalDate {
  return toLocalDate(addDays(parseLocalDate(value), amount));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(value: LocalDate): number {
  return parseLocalDate(value).getDay();
}

/** "Hoje", "Ontem", "Amanhã" or e.g. "segunda-feira, 15 de setembro". */
export function formatDayLabel(value: LocalDate, today: LocalDate): string {
  if (value === today) return t('Hoje');
  if (value === addDaysLocal(today, -1)) return t('Ontem');
  if (value === addDaysLocal(today, 1)) return t('Amanhã');
  const sameYear = value.slice(0, 4) === today.slice(0, 4);
  return formatWith(
    parseLocalDate(value),
    sameYear ? "EEEE, d 'de' MMMM" : "EEEE, d 'de' MMMM 'de' yyyy",
    sameYear ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy',
  );
}

/** e.g. "15 de set. de 2026". */
export function formatShortDate(value: LocalDate): string {
  return formatWith(parseLocalDate(value), "d 'de' MMM 'de' yyyy", 'MMM d, yyyy');
}
