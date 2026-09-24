import { makeHabit } from '@/core/habits/testing';
import { makeEvent } from '@/core/planner/testing';

import { planReminders } from './plan';
import { reminderData, reminderRoute } from './route';

const today = '2026-09-21';
const now = new Date(2026, 8, 21, 10, 0);

describe('reminderRoute', () => {
  it("opens the habit's entry for the day the reminder was for", () => {
    const [daily] = planReminders([makeHabit({ id: 'h1', reminders: ['20:00'] })], today, now);
    expect(reminderRoute(reminderData(daily!), today)).toBe('/entry?habitId=h1&date=2026-09-21');

    const interval = makeHabit({
      id: 'h2',
      startDate: '2026-09-21',
      reminders: ['20:00'],
      frequency: { type: 'interval', every: 2 },
    });
    const [first] = planReminders([interval], today, now);
    // Tapped two days later: still the day it reminded about.
    expect(reminderRoute(reminderData(first!), '2026-09-23')).toBe(
      '/entry?habitId=h2&date=2026-09-21',
    );
  });

  it('opens the event occurrence', () => {
    const event = makeEvent({
      id: 'e1',
      date: '2026-09-22',
      startTime: '09:00',
      reminderMinutes: 10,
    });
    const [reminder] = planReminders([], today, now, [event]);
    expect(reminderRoute(reminderData(reminder!), today)).toBe('/event/e1?date=2026-09-22');
  });

  it('ignores unexpected data', () => {
    for (const data of [null, undefined, 'x', {}, { habitId: 3 }, { eventId: '' }]) {
      expect(reminderRoute(data, today)).toBeNull();
    }
    // A malformed or future day falls back to today; ids are encoded.
    expect(reminderRoute({ habitId: 'a/b', date: '2030-01-01' }, today)).toBe(
      '/entry?habitId=a%2Fb&date=2026-09-21',
    );
  });
});
