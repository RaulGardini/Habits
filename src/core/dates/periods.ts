import { endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from 'date-fns';

import type { PeriodUnit, WeekStartsOn } from '@/core/habits/types';

import {
  addDaysLocal,
  dayNumber,
  fromDayNumber,
  parseLocalDate,
  toLocalDate,
  type LocalDate,
} from './localDate';

export type RangeUnit = PeriodUnit | 'year';

export interface DateRange {
  from: LocalDate;
  /** Inclusive. */
  to: LocalDate;
}

export function periodRange(
  date: LocalDate,
  unit: RangeUnit,
  weekStartsOn: WeekStartsOn,
): DateRange {
  const day = parseLocalDate(date);
  switch (unit) {
    case 'week':
      return {
        from: toLocalDate(startOfWeek(day, { weekStartsOn })),
        to: toLocalDate(endOfWeek(day, { weekStartsOn })),
      };
    case 'month':
      return { from: toLocalDate(startOfMonth(day)), to: toLocalDate(endOfMonth(day)) };
    case 'year':
      return { from: toLocalDate(startOfYear(day)), to: toLocalDate(endOfYear(day)) };
  }
}

/** Start of the next period after the one containing `date`. */
export function nextPeriodStart(
  date: LocalDate,
  unit: RangeUnit,
  weekStartsOn: WeekStartsOn,
): LocalDate {
  return addDaysLocal(periodRange(date, unit, weekStartsOn).to, 1);
}

/** A date in the previous/next period (same position when possible). */
export function shiftPeriod(date: LocalDate, unit: RangeUnit, amount: number): LocalDate {
  const d = parseLocalDate(date);
  switch (unit) {
    case 'week':
      return addDaysLocal(date, amount * 7);
    case 'month': {
      const target = new Date(d.getFullYear(), d.getMonth() + amount, 1);
      const lastDay = endOfMonth(target).getDate();
      return toLocalDate(
        new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)),
      );
    }
    case 'year': {
      const target = new Date(d.getFullYear() + amount, d.getMonth(), 1);
      const lastDay = endOfMonth(target).getDate();
      return toLocalDate(
        new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)),
      );
    }
  }
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** Every day in the inclusive range, in order. Empty when `from > to`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  const last = dayNumber(to);
  for (let day = dayNumber(from); day <= last; day++) days.push(fromDayNumber(day));
  return days;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

/** `YYYY-MM` key of a date. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

/** `YYYY` key of a date. */
export function yearKey(date: LocalDate): string {
  return date.slice(0, 4);
}
