import { formatWith, getLanguage } from '@/i18n/i18n';

import { parseLocalDate, type LocalDate } from '@/core/dates/localDate';

/** "setembro de 2026" */
export function monthLabel(date: LocalDate): string {
  return formatWith(parseLocalDate(date), "MMMM 'de' yyyy", 'MMMM yyyy');
}

/** "qua., 23 set." */
export function shortDayLabel(date: LocalDate): string {
  return formatWith(parseLocalDate(date), 'EEE, d MMM', 'EEE, MMM d');
}

/** "23 – 29 set." or "29 set. – 5 out." */
export function weekLabel(from: LocalDate, to: LocalDate): string {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const end = formatWith(b, 'd MMM', 'MMM d');
  if (a.getMonth() === b.getMonth()) {
    return getLanguage() === 'en'
      ? `${formatWith(a, 'd MMM', 'MMM d')} – ${b.getDate()}`
      : `${a.getDate()} – ${end}`;
  }
  return `${formatWith(a, 'd MMM', 'MMM d')} – ${end}`;
}
