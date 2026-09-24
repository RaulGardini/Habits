import { addDaysLocal, weekdayOf, type LocalDate } from '@/core/dates/localDate';
import { weekdaysFromMask } from '@/core/dates/weekdays';
import { formatNumber } from '@/core/format';
import { periodQuota } from '@/core/habits/quota';
import { isScheduledOn } from '@/core/habits/schedule';
import type { Habit, HabitEntry, WeekStartsOn } from '@/core/habits/types';
import { eventTimeLabel, expandOccurrences, reminderMoment } from '@/core/planner/agenda';
import type { PlannerEvent } from '@/core/planner/types';
import { t } from '@/i18n/i18n';

/** iOS keeps at most 64 pending local notifications; stay below it. */
export const MAX_SCHEDULED = 60;
/** How far ahead one-off reminders are scheduled (re-planned every time the app opens). */
export const ONE_OFF_HORIZON_DAYS = 21;

export type ReminderTrigger =
  | { type: 'daily'; hour: number; minute: number }
  /** `weekday` uses the notification convention: 1 = Sunday … 7 = Saturday. */
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'date'; date: LocalDate; hour: number; minute: number };

export interface PlannedReminder {
  /** Habit or event the reminder belongs to (sent in the notification data). */
  habitId?: string;
  eventId?: string;
  /** Event occurrence the reminder is for (a reminder may fire the day before). */
  occurrence?: LocalDate;
  title: string;
  body: string;
  trigger: ReminderTrigger;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return { hour, minute };
}

function timeOfDayMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * One-off reminders for the next scheduled days (used when repeating triggers cannot express
 * the frequency: "every X days", or a habit that has not started yet).
 */
function oneOffReminders(
  habit: Habit,
  time: string,
  today: LocalDate,
  now: Date,
): ReminderTrigger[] {
  const { hour, minute } = parseTime(time);
  const triggers: ReminderTrigger[] = [];
  for (let offset = 0; offset <= ONE_OFF_HORIZON_DAYS; offset++) {
    const date = addDaysLocal(today, offset);
    if (!isScheduledOn(habit, date)) continue;
    if (offset === 0 && hour * 60 + minute <= timeOfDayMinutes(now)) continue;
    triggers.push({ type: 'date', date, hour, minute });
  }
  return triggers;
}

function triggersFor(habit: Habit, time: string, today: LocalDate, now: Date): ReminderTrigger[] {
  const { hour, minute } = parseTime(time);
  if (habit.startDate > today) return oneOffReminders(habit, time, today, now);
  switch (habit.frequency.type) {
    case 'daily':
    case 'per_period':
      return [{ type: 'daily', hour, minute }];
    case 'weekdays':
      return weekdaysFromMask(habit.frequency.days).map((weekday) => ({
        type: 'weekly',
        weekday: weekday + 1,
        hour,
        minute,
      }));
    case 'interval':
      return oneOffReminders(habit, time, today, now);
  }
}

/**
 * Triggers of a habit already settled today, without the ones still to fire today. A repeating
 * daily trigger becomes weekly triggers for the other six weekdays plus a one-off for the same
 * weekday next week (re-planned long before, whenever the app opens).
 */
function withoutToday(triggers: ReminderTrigger[], today: LocalDate): ReminderTrigger[] {
  const todayWeekday = notificationWeekday(today);
  const nextWeek = addDaysLocal(today, 7);
  return triggers.flatMap((trigger): ReminderTrigger[] => {
    const { hour, minute } = trigger;
    switch (trigger.type) {
      case 'date':
        return trigger.date === today ? [] : [trigger];
      case 'weekly':
        return trigger.weekday === todayWeekday
          ? [{ type: 'date', date: nextWeek, hour, minute }]
          : [trigger];
      case 'daily':
        return [
          ...[1, 2, 3, 4, 5, 6, 7]
            .filter((weekday) => weekday !== todayWeekday)
            .map((weekday): ReminderTrigger => ({ type: 'weekly', weekday, hour, minute })),
          { type: 'date', date: nextWeek, hour, minute },
        ];
    }
  });
}

/**
 * Habits that need no reminder for the rest of today: done or skipped today, or (flexible
 * habits) with the week's/month's quota already met.
 */
export function settledToday(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  today: LocalDate,
  weekStartsOn: WeekStartsOn,
): Set<string> {
  const settled = new Set<string>();
  for (const entry of entries) {
    if (entry.date === today && (entry.status === 'done' || entry.status === 'skipped')) {
      settled.add(entry.habitId);
    }
  }
  for (const habit of habits) {
    if (periodQuota(habit, today, entries, weekStartsOn)?.met) settled.add(habit.id);
  }
  return settled;
}

/** Sort key: repeating triggers first (they never expire), then one-offs by time. */
function priority(trigger: ReminderTrigger): string {
  if (trigger.type !== 'date') return '0';
  return `1 ${trigger.date} ${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
}

/**
 * Every local notification to schedule for the given habits. The whole set is re-planned and
 * re-scheduled whenever habits or today's entries change and when the app starts or returns
 * (so one-off reminders roll forward). Habits in `settled` (see `settledToday`) get no more
 * reminders today — unless that would push repeating reminders over the cap: an extra reminder
 * is better than a lost one.
 */
export function planReminders(
  habits: readonly Habit[],
  today: LocalDate,
  now: Date,
  events: readonly PlannerEvent[] = [],
  settled: ReadonlySet<string> = new Set(),
): PlannedReminder[] {
  const planned = plan(habits, today, now, events, settled);
  const repeating = planned.filter((reminder) => reminder.trigger.type !== 'date').length;
  const all = repeating > MAX_SCHEDULED ? plan(habits, today, now, events, new Set()) : planned;
  return all
    .sort((a, b) => priority(a.trigger).localeCompare(priority(b.trigger)))
    .slice(0, MAX_SCHEDULED);
}

function plan(
  habits: readonly Habit[],
  today: LocalDate,
  now: Date,
  events: readonly PlannerEvent[],
  settled: ReadonlySet<string>,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [...eventReminders(events, today, now)];
  const nowMinutes = timeOfDayMinutes(now);
  for (const habit of habits) {
    if (habit.archivedAt !== null) continue;
    for (const time of habit.reminders) {
      const { hour, minute } = parseTime(time);
      const stillToFire = hour * 60 + minute > nowMinutes;
      let triggers = triggersFor(habit, time, today, now);
      if (stillToFire && settled.has(habit.id)) triggers = withoutToday(triggers, today);
      for (const trigger of triggers) {
        planned.push({
          habitId: habit.id,
          title: habit.name,
          body: reminderBody(habit),
          trigger,
        });
      }
    }
  }
  return planned;
}

/**
 * One-off reminders for event occurrences in the next `ONE_OFF_HORIZON_DAYS` (a reminder the
 * day before is included for tomorrow's first days). Past moments are dropped.
 */
export function eventReminders(
  events: readonly PlannerEvent[],
  today: LocalDate,
  now: Date,
): PlannedReminder[] {
  const nowMinutes = timeOfDayMinutes(now);
  const horizon = addDaysLocal(today, ONE_OFF_HORIZON_DAYS);
  const planned: PlannedReminder[] = [];
  for (const { event, date } of expandOccurrences(events, today, horizon)) {
    const moment = reminderMoment(event, date);
    if (!moment || moment.date < today || moment.date > horizon) continue;
    if (moment.date === today && moment.hour * 60 + moment.minute <= nowMinutes) continue;
    const when = date === today ? t('Hoje') : date === addDaysLocal(today, 1) ? t('Amanhã') : date;
    planned.push({
      eventId: event.id,
      occurrence: date,
      title: event.title,
      body: [`${when} · ${eventTimeLabel(event)}`, event.location].filter(Boolean).join(' · '),
      trigger: { type: 'date', ...moment },
    });
  }
  return planned;
}

export function reminderBody(habit: Habit): string {
  switch (habit.tracking.type) {
    case 'boolean':
      return t('Hora do seu hábito. Toque para marcar como feito.');
    case 'quantity':
      return t('Meta de hoje: {value} {unit}.', {
        value: formatNumber(habit.tracking.target),
        unit: habit.tracking.unit,
      });
    case 'timer':
      return t('Meta de hoje: {minutes} min.', {
        minutes: Math.round(habit.tracking.targetSeconds / 60),
      });
  }
}

/** Weekday of a local date in notification convention (1 = Sunday). */
export function notificationWeekday(date: LocalDate): number {
  return weekdayOf(date) + 1;
}
