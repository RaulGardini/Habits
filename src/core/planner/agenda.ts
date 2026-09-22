import { addDaysLocal, parseLocalDate, weekdayOf, type LocalDate } from '@/core/dates/localDate';
import { eachDay, maxDate, minDate } from '@/core/dates/periods';

import { minutesOf } from './planner';
import type { EventDraft, EventOccurrence, EventRepeat, PlannerEvent } from './types';

/** Base time of reminders for all-day events. */
export const ALL_DAY_REMINDER_TIME = '09:00';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Last day the event can happen, clipped to `limit`. */
function lastDay(event: PlannerEvent, limit: LocalDate): LocalDate {
  if (event.repeat === 'none') return minDate(event.date, limit);
  return event.repeatUntil === null ? limit : minDate(event.repeatUntil, limit);
}

/**
 * Does the event happen on `date`? Monthly series skip months without that day (31st),
 * yearly series on Feb 29 only happen in leap years.
 */
export function occursOn(event: PlannerEvent, date: LocalDate): boolean {
  if (date < event.date) return false;
  if (event.repeat !== 'none' && event.repeatUntil !== null && date > event.repeatUntil) {
    return false;
  }
  if (event.excludedDates.includes(date)) return false;
  switch (event.repeat) {
    case 'none':
      return date === event.date;
    case 'daily':
      return true;
    case 'weekly':
      return weekdayOf(date) === weekdayOf(event.date);
    case 'monthly':
      return date.slice(8) === event.date.slice(8);
    case 'yearly':
      return date.slice(5) === event.date.slice(5);
  }
}

/** All-day first, then by start time, end time and title. */
function compareOnSameDay(a: PlannerEvent, b: PlannerEvent): number {
  return (
    Number(b.allDay) - Number(a.allDay) ||
    a.startTime.localeCompare(b.startTime) ||
    (a.endTime ?? '').localeCompare(b.endTime ?? '') ||
    a.title.localeCompare(b.title)
  );
}

/** Every occurrence of `events` between `from` and `to` (inclusive), in chronological order. */
export function expandOccurrences(
  events: readonly PlannerEvent[],
  from: LocalDate,
  to: LocalDate,
): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    const start = maxDate(from, event.date);
    const end = lastDay(event, to);
    if (start > end) continue;
    const days = event.repeat === 'none' ? [event.date] : eachDay(start, end);
    for (const date of days) {
      if (occursOn(event, date)) occurrences.push({ event, date });
    }
  }
  return occurrences.sort(
    (a, b) => a.date.localeCompare(b.date) || compareOnSameDay(a.event, b.event),
  );
}

/** Occurrences grouped by day, keeping the chronological order. */
export function groupByDate(
  occurrences: readonly EventOccurrence[],
): Map<LocalDate, EventOccurrence[]> {
  const groups = new Map<LocalDate, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = groups.get(occurrence.date);
    if (list) list.push(occurrence);
    else groups.set(occurrence.date, [occurrence]);
  }
  return groups;
}

/** End minute of a timed event (events without an end last 1 hour for overlap purposes). */
export function endMinutes(event: PlannerEvent): number {
  return event.endTime === null ? minutesOf(event.startTime) + 60 : minutesOf(event.endTime);
}

/** Ids of timed events that overlap another one on the same day. */
export function conflictingIds(dayOccurrences: readonly EventOccurrence[]): Set<string> {
  const timed = dayOccurrences.filter((o) => !o.event.allDay).map((o) => o.event);
  const ids = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (!a || !b) continue;
      if (minutesOf(a.startTime) < endMinutes(b) && minutesOf(b.startTime) < endMinutes(a)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

/**
 * Side-by-side layout for the day timeline: overlapping events split the width.
 * Returns, per event id, its column and the number of columns of its overlap group.
 */
export function layoutColumns(
  dayOccurrences: readonly EventOccurrence[],
): Map<string, { column: number; columns: number }> {
  const timed = dayOccurrences
    .filter((o) => !o.event.allDay)
    .map((o) => o.event)
    .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));
  const result = new Map<string, { column: number; columns: number }>();
  let group: PlannerEvent[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = columnEnds.length;
    for (const event of group) {
      const entry = result.get(event.id);
      if (entry) entry.columns = columns;
    }
    group = [];
    columnEnds = [];
  };

  for (const event of timed) {
    const start = minutesOf(event.startTime);
    if (start >= groupEnd) flush();
    let column = columnEnds.findIndex((end) => end <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = endMinutes(event);
    result.set(event.id, { column, columns: 1 });
    group.push(event);
    groupEnd = Math.max(groupEnd, endMinutes(event));
  }
  flush();
  return result;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "Dia inteiro", "09:00", or "09:00 – 10:30". */
export function eventTimeLabel(
  event: Pick<EventDraft, 'allDay' | 'startTime' | 'endTime'>,
): string {
  if (event.allDay) return 'Dia inteiro';
  return event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
}

export const REPEAT_OPTIONS: readonly EventRepeat[] = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
];

/** pt-BR description of the repetition, based on the first day of the series. */
export function repeatLabel(repeat: EventRepeat, date: LocalDate): string {
  const parsed = parseLocalDate(date);
  switch (repeat) {
    case 'none':
      return 'Não se repete';
    case 'daily':
      return 'Todo dia';
    case 'weekly':
      return `Toda semana (${WEEKDAYS[weekdayOf(date)]})`;
    case 'monthly':
      return `Todo mês (dia ${parsed.getDate()})`;
    case 'yearly':
      return `Todo ano (${parsed.getDate()} de ${MONTHS[parsed.getMonth()]})`;
  }
}

/** Short label for chips. */
export function repeatShortLabel(repeat: EventRepeat): string {
  return { none: 'Não', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' }[
    repeat
  ];
}

export const REMINDER_OPTIONS: readonly (number | null)[] = [null, 0, 10, 30, 60, 1440];

export function reminderLabel(minutes: number | null, allDay: boolean): string {
  if (minutes === null) return 'Sem lembrete';
  if (allDay) {
    if (minutes === 0) return 'No dia, às 9h';
    if (minutes === 1440) return 'Na véspera, às 9h';
  }
  if (minutes === 0) return 'Na hora';
  if (minutes === 1440) return '1 dia antes';
  if (minutes % 60 === 0) return `${minutes / 60} h antes`;
  return `${minutes} min antes`;
}

/** Local day and `HH:mm` at which the reminder of an occurrence fires. */
export function reminderMoment(
  event: PlannerEvent,
  date: LocalDate,
): { date: LocalDate; hour: number; minute: number } | null {
  if (event.reminderMinutes === null) return null;
  const base = minutesOf(event.allDay ? ALL_DAY_REMINDER_TIME : event.startTime);
  let total = base - event.reminderMinutes;
  let day = date;
  while (total < 0) {
    total += 1440;
    day = addDaysLocal(day, -1);
  }
  return { date: day, hour: Math.floor(total / 60), minute: total % 60 };
}

/** Empty draft for a new event on `date` (optionally at a given hour). */
export function newEventDraft(date: LocalDate, hour?: number): EventDraft {
  const start = hour ?? 9;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    title: '',
    date,
    allDay: false,
    startTime: `${pad(start)}:00`,
    endTime: start < 23 ? `${pad(start + 1)}:00` : null,
    location: null,
    color: 'amber',
    note: null,
    repeat: 'none',
    repeatUntil: null,
    excludedDates: [],
    reminderMinutes: 10,
  };
}
