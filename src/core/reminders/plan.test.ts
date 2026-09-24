import { makeEntry, makeHabit } from '@/core/habits/testing';
import { makeEvent } from '@/core/planner/testing';

import {
  MAX_SCHEDULED,
  notificationWeekday,
  planReminders,
  reminderBody,
  settledToday,
} from './plan';

const today = '2026-09-21'; // Monday
const now = new Date(2026, 8, 21, 10, 0);

describe('planReminders', () => {
  it('uses a daily trigger per time for daily habits', () => {
    const habit = makeHabit({ reminders: ['08:00', '20:30'] });
    expect(planReminders([habit], today, now).map((r) => r.trigger)).toEqual([
      { type: 'daily', hour: 8, minute: 0 },
      { type: 'daily', hour: 20, minute: 30 },
    ]);
  });

  it('uses weekly triggers (1 = Sunday) for specific weekdays', () => {
    const habit = makeHabit({
      reminders: ['07:00'],
      frequency: { type: 'weekdays', days: (1 << 1) | (1 << 5) }, // Mon, Fri
    });
    expect(planReminders([habit], today, now).map((r) => r.trigger)).toEqual([
      { type: 'weekly', weekday: 2, hour: 7, minute: 0 },
      { type: 'weekly', weekday: 6, hour: 7, minute: 0 },
    ]);
  });

  it('reminds flexible habits every day', () => {
    const habit = makeHabit({
      reminders: ['18:00'],
      frequency: { type: 'per_period', count: 3, period: 'week' },
    });
    expect(planReminders([habit], today, now)[0]?.trigger.type).toBe('daily');
  });

  it('schedules one-off reminders for interval habits, skipping past times today', () => {
    const habit = makeHabit({
      startDate: '2026-09-21',
      reminders: ['09:00'],
      frequency: { type: 'interval', every: 3 },
    });
    const dates = planReminders([habit], today, now).map((r) =>
      r.trigger.type === 'date' ? r.trigger.date : null,
    );
    // Today 09:00 already passed at 10:00 → first one is on the 24th.
    expect(dates.slice(0, 3)).toEqual(['2026-09-24', '2026-09-27', '2026-09-30']);
  });

  it('uses one-off reminders until a future start date', () => {
    const habit = makeHabit({ startDate: '2026-09-23', reminders: ['08:00'] });
    const planned = planReminders([habit], today, now);
    expect(planned[0]?.trigger).toEqual({ type: 'date', date: '2026-09-23', hour: 8, minute: 0 });
  });

  it('ignores archived habits and habits without reminders', () => {
    expect(
      planReminders(
        [makeHabit({ archivedAt: '2026-01-01T00:00:00Z', reminders: ['08:00'] }), makeHabit()],
        today,
        now,
      ),
    ).toEqual([]);
  });

  it('caps the total, keeping repeating reminders first', () => {
    const interval = makeHabit({
      id: 'i',
      reminders: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
      frequency: { type: 'interval', every: 2 },
    });
    const daily = makeHabit({ id: 'd', reminders: ['07:00'] });
    const planned = planReminders([interval, daily], today, now);
    expect(planned).toHaveLength(MAX_SCHEDULED);
    expect(planned[0]?.habitId).toBe('d');
  });
});

describe('habits already settled today', () => {
  const settled = new Set(['habit-1']);
  const byType = (reminders: ReturnType<typeof planReminders>) => reminders.map((r) => r.trigger);

  it('keeps every other day of a daily reminder still to fire today', () => {
    const habit = makeHabit({ reminders: ['20:00'] }); // today is Monday (weekday 2), 10:00
    expect(byType(planReminders([habit], today, now, [], settled))).toEqual([
      ...[1, 3, 4, 5, 6, 7].map((weekday) => ({ type: 'weekly', weekday, hour: 20, minute: 0 })),
      { type: 'date', date: '2026-09-28', hour: 20, minute: 0 },
    ]);
  });

  it('leaves reminders that already fired today alone', () => {
    const habit = makeHabit({ reminders: ['08:00'] });
    expect(byType(planReminders([habit], today, now, [], settled))).toEqual([
      { type: 'daily', hour: 8, minute: 0 },
    ]);
  });

  it("drops only today's weekly or one-off reminder", () => {
    const weekdays = makeHabit({
      reminders: ['19:00'],
      frequency: { type: 'weekdays', days: (1 << 1) | (1 << 3) }, // Mon, Wed
    });
    expect(byType(planReminders([weekdays], today, now, [], settled))).toEqual([
      { type: 'weekly', weekday: 4, hour: 19, minute: 0 },
      { type: 'date', date: '2026-09-28', hour: 19, minute: 0 },
    ]);
    const interval = makeHabit({
      startDate: '2026-09-21',
      reminders: ['19:00'],
      frequency: { type: 'interval', every: 3 },
    });
    expect(
      byType(planReminders([interval], today, now, [], settled)).map((t) =>
        t.type === 'date' ? t.date : t.type,
      ),
    ).toEqual([
      '2026-09-24',
      '2026-09-27',
      '2026-09-30',
      '2026-10-03',
      '2026-10-06',
      '2026-10-09',
      '2026-10-12',
    ]);
  });

  it('falls back to plain reminders rather than dropping any when over the cap', () => {
    // 11 settled daily habits would need 66 weekly triggers: over the cap.
    const habits = Array.from({ length: 11 }, (_, i) =>
      makeHabit({ id: `h${i}`, reminders: ['21:00'] }),
    );
    const planned = planReminders(habits, today, now, [], new Set(habits.map((h) => h.id)));
    expect(byType(planned)).toEqual(habits.map(() => ({ type: 'daily', hour: 21, minute: 0 })));
  });

  it('settles habits done or skipped today and flexible habits with the quota met', () => {
    const daily = makeHabit({ id: 'daily' });
    const skipped = makeHabit({ id: 'skipped' });
    const partial = makeHabit({ id: 'partial' });
    const weekly = makeHabit({
      id: 'weekly',
      frequency: { type: 'per_period', count: 1, period: 'week' },
    });
    const entries = [
      makeEntry({ id: '1', habitId: 'daily', date: today, status: 'done' }),
      makeEntry({ id: '2', habitId: 'daily', date: '2026-09-20', status: 'done' }),
      makeEntry({ id: '3', habitId: 'skipped', date: today, status: 'skipped' }),
      makeEntry({ id: '4', habitId: 'partial', date: today, status: 'partial' }),
      makeEntry({ id: '5', habitId: 'weekly', date: '2026-09-20', status: 'done' }), // Sunday
    ];
    const habits = [daily, skipped, partial, weekly];
    // Weeks start on Sunday: Sunday's check already met this week's quota.
    expect([...settledToday(habits, entries, today, 0)].sort()).toEqual([
      'daily',
      'skipped',
      'weekly',
    ]);
    // Weeks start on Monday: Sunday belongs to last week.
    expect(settledToday(habits, entries, today, 1).has('weekly')).toBe(false);
  });
});

describe('event reminders', () => {
  it('schedules upcoming occurrences before their start and skips past ones', () => {
    const events = [
      makeEvent({ id: 'past', startTime: '09:00', reminderMinutes: 10 }), // 08:50 today: gone
      makeEvent({ id: 'later', startTime: '15:00', reminderMinutes: 30, location: 'Escritório' }),
      makeEvent({ id: 'none', startTime: '16:00' }),
      makeEvent({
        id: 'weekly',
        date: '2026-09-22',
        startTime: '07:00',
        reminderMinutes: 60,
        repeat: 'weekly',
      }),
    ];
    const planned = planReminders([], today, now, events);
    expect(
      planned.map((r) => `${r.eventId} ${r.trigger.type === 'date' ? r.trigger.date : ''}`),
    ).toEqual(['later 2026-09-21', 'weekly 2026-09-22', 'weekly 2026-09-29', 'weekly 2026-10-06']);
    expect(planned[0]).toMatchObject({
      title: 'Evento',
      body: 'Hoje · 15:00 · Escritório',
      trigger: { type: 'date', date: today, hour: 14, minute: 30 },
    });
  });
});

describe('reminderBody', () => {
  it('mentions the target for measurable habits', () => {
    expect(
      reminderBody(makeHabit({ tracking: { type: 'quantity', target: 2.5, unit: 'L', step: 1 } })),
    ).toBe('Meta de hoje: 2,5 L.');
    expect(reminderBody(makeHabit({ tracking: { type: 'timer', targetSeconds: 1800 } }))).toBe(
      'Meta de hoje: 30 min.',
    );
  });
});

describe('notificationWeekday', () => {
  it('maps Sunday to 1', () => {
    expect(notificationWeekday('2026-09-20')).toBe(1);
    expect(notificationWeekday('2026-09-26')).toBe(7);
  });
});
