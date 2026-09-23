import { formatWith, t } from '@/i18n/i18n';

/**
 * A calendar day in the user's local time zone, formatted as `YYYY-MM-DD`.
 * Stored as text (never as a timestamp) so a day never shifts across time zones.
 * Lexicographic order equals chronological order.
 */
export type LocalDate = string;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/*
 * Day arithmetic is done on the proleptic Gregorian calendar with plain integers (days since
 * 1970-01-01), never through `Date` math: it is fast (stats walk tens of thousands of days) and
 * cannot be shifted by time zones or daylight saving changes (a DST switch at midnight, as in
 * Brazil until 2019, makes local midnight not exist).
 */

/** Days since 1970-01-01 of a civil date (month 1..12). */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(days: number): LocalDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return formatCivil(year, month, day);
}

const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value));

function formatCivil(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** [year, month 1..12, day] of a valid local date, or null. */
function civilParts(value: string): [number, number, number] | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

function partsOrThrow(value: LocalDate): [number, number, number] {
  const parts = civilParts(value);
  if (!parts) throw new Error(`Invalid local date: "${value}"`);
  return parts;
}

/** Day number (days since 1970-01-01) of a local date; differences are whole calendar days. */
/*
 * Stats and streaks convert the same few thousand days back and forth for every habit, so both
 * directions are memoized (a bounded cache: cleared when it grows past a few years of days).
 */
const CACHE_LIMIT = 20_000;
const dayNumbers = new Map<LocalDate, number>();
const localDates = new Map<number, LocalDate>();

export function dayNumber(value: LocalDate): number {
  let days = dayNumbers.get(value);
  if (days === undefined) {
    days = daysFromCivil(...partsOrThrow(value));
    if (dayNumbers.size >= CACHE_LIMIT) dayNumbers.clear();
    dayNumbers.set(value, days);
  }
  return days;
}

/** Local date of a day number (see `dayNumber`). */
export function fromDayNumber(days: number): LocalDate {
  let value = localDates.get(days);
  if (value === undefined) {
    value = civilFromDays(days);
    if (localDates.size >= CACHE_LIMIT) localDates.clear();
    localDates.set(days, value);
  }
  return value;
}

export function toLocalDate(date: Date): LocalDate {
  return formatCivil(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function isLocalDate(value: string): value is LocalDate {
  return civilParts(value) !== null;
}

/**
 * Returns a Date at the start of the given local day (local midnight, or the first valid local
 * time when a DST change skips midnight).
 */
export function parseLocalDate(value: LocalDate): Date {
  const [year, month, day] = partsOrThrow(value);
  const date = new Date(year, month - 1, day);
  // Years 0..99 are mapped to 1900..1999 by the Date constructor.
  if (year < 100) date.setFullYear(year);
  return date;
}

export function addDaysLocal(value: LocalDate, amount: number): LocalDate {
  return fromDayNumber(dayNumber(value) + amount);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(value: LocalDate): number {
  // 1970-01-01 was a Thursday.
  return (((dayNumber(value) + 4) % 7) + 7) % 7;
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
