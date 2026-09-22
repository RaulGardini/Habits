import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { parseLocalDate, type LocalDate } from '@/core/dates/localDate';

/** "setembro de 2026" */
export function monthLabel(date: LocalDate): string {
  return format(parseLocalDate(date), "MMMM 'de' yyyy", { locale: ptBR });
}

/** "qua., 23 set." */
export function shortDayLabel(date: LocalDate): string {
  return format(parseLocalDate(date), 'EEE, d MMM', { locale: ptBR });
}

/** "23 – 29 set." or "29 set. – 5 out." */
export function weekLabel(from: LocalDate, to: LocalDate): string {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const end = format(b, 'd MMM', { locale: ptBR });
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${end}`;
  return `${format(a, 'd MMM', { locale: ptBR })} – ${end}`;
}
