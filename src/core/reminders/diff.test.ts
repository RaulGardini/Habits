import { makeHabit } from '@/core/habits/testing';

import { reminderId, scheduleChanges } from './diff';
import { planReminders } from './plan';

const today = '2026-09-21'; // Monday
const now = new Date(2026, 8, 21, 10, 0);
const read = makeHabit({ id: 'read', name: 'Ler', reminders: ['20:00'] });
const walk = makeHabit({ id: 'walk', name: 'Caminhar', reminders: ['21:00'] });

describe('scheduleChanges', () => {
  it('gives the same id to the same reminder, a new one when anything changes', () => {
    const [a] = planReminders([read], today, now);
    const [b] = planReminders([read], today, now);
    const [renamed] = planReminders([{ ...read, name: 'Ler 10 páginas' }], today, now);
    expect(reminderId(a!)).toBe(reminderId(b!));
    expect(reminderId(renamed!)).not.toBe(reminderId(a!));
  });

  it('does nothing when the plan did not change', () => {
    const plan = planReminders([read, walk], today, now);
    expect(scheduleChanges(plan.map(reminderId), plan)).toEqual({ cancel: [], add: [] });
  });

  it("checking a habit cancels only its daily reminder and adds the other days'", () => {
    const before = planReminders([read, walk], today, now);
    const after = planReminders([read, walk], today, now, [], new Set(['read']));
    const changes = scheduleChanges(before.map(reminderId), after);
    expect(changes.cancel).toEqual([reminderId(before.find((r) => r.habitId === 'read')!)]);
    expect(changes.add.map((a) => a.reminder.habitId)).toEqual(Array(7).fill('read'));
    // Walking's reminder is left alone.
    expect(changes.cancel).not.toContain(reminderId(before.find((r) => r.habitId === 'walk')!));
  });

  it('removes notifications scheduled by an older version of the app', () => {
    const plan = planReminders([read], today, now);
    expect(scheduleChanges(['old-random-uuid'], plan)).toEqual({
      cancel: ['old-random-uuid'],
      add: [{ id: reminderId(plan[0]!), reminder: plan[0] }],
    });
  });
});
