import type { WeekStartsOn } from '@/core/habits/types';

/** pt-BR short weekday names, index 0 = Sunday. */
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;
/** Single-letter labels for compact grids (index 0 = Sunday). */
export const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

export const ALL_WEEKDAYS_MASK = 0b1111111;

export function hasWeekday(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}

export function toggleWeekday(mask: number, weekday: number): number {
  return mask ^ (1 << weekday);
}

export function weekdaysFromMask(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => hasWeekday(mask, d));
}

export function maskFromWeekdays(weekdays: readonly number[]): number {
  return weekdays.reduce((mask, d) => mask | (1 << d), 0);
}

/** Weekday indexes in display order, e.g. [1..6, 0] when the week starts on Monday. */
export function orderedWeekdays(weekStartsOn: WeekStartsOn): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);
}

export function weekdayShort(weekday: number): string {
  return WEEKDAY_SHORT[weekday] ?? '';
}

export function weekdayLong(weekday: number): string {
  return WEEKDAY_LONG[weekday] ?? '';
}
