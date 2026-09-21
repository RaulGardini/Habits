import { makeHabit } from '@/core/habits/testing';

import { MAX_SCHEDULED, notificationWeekday, planReminders, reminderBody } from './plan';

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
