import {
  conflictingIds,
  eventTimeLabel,
  expandOccurrences,
  layoutColumns,
  occursOn,
  reminderLabel,
  reminderMoment,
  repeatLabel,
} from './agenda';
import { makeEvent } from './testing';

describe('occursOn', () => {
  it('handles one-off events', () => {
    const event = makeEvent({ date: '2026-09-21' });
    expect(occursOn(event, '2026-09-21')).toBe(true);
    expect(occursOn(event, '2026-09-22')).toBe(false);
  });

  it('repeats daily, weekly, monthly and yearly from the first day', () => {
    const base = { date: '2026-01-31' };
    expect(occursOn(makeEvent({ ...base, repeat: 'daily' }), '2026-01-30')).toBe(false);
    expect(occursOn(makeEvent({ ...base, repeat: 'daily' }), '2026-05-02')).toBe(true);
    // 2026-01-31 is a Saturday.
    expect(occursOn(makeEvent({ ...base, repeat: 'weekly' }), '2026-02-07')).toBe(true);
    expect(occursOn(makeEvent({ ...base, repeat: 'weekly' }), '2026-02-08')).toBe(false);
    // Monthly on the 31st skips shorter months.
    expect(occursOn(makeEvent({ ...base, repeat: 'monthly' }), '2026-03-31')).toBe(true);
    expect(occursOn(makeEvent({ ...base, repeat: 'monthly' }), '2026-02-28')).toBe(false);
    expect(occursOn(makeEvent({ ...base, repeat: 'yearly' }), '2027-01-31')).toBe(true);
  });

  it('respects the end of the series and removed days', () => {
    const event = makeEvent({
      repeat: 'daily',
      repeatUntil: '2026-09-25',
      excludedDates: ['2026-09-23'],
    });
    expect(occursOn(event, '2026-09-22')).toBe(true);
    expect(occursOn(event, '2026-09-23')).toBe(false);
    expect(occursOn(event, '2026-09-26')).toBe(false);
  });
});

describe('expandOccurrences', () => {
  it('lists occurrences in order, all-day first', () => {
    const occurrences = expandOccurrences(
      [
        makeEvent({ id: 'gym', startTime: '18:00', repeat: 'weekly', date: '2026-09-07' }),
        makeEvent({ id: 'trip', date: '2026-09-21', allDay: true, startTime: '00:00' }),
        makeEvent({ id: 'call', date: '2026-09-21', startTime: '08:00' }),
      ],
      '2026-09-14',
      '2026-09-21',
    );
    expect(occurrences.map((o) => `${o.date} ${o.event.id}`)).toEqual([
      '2026-09-14 gym',
      '2026-09-21 trip',
      '2026-09-21 call',
      '2026-09-21 gym',
    ]);
  });
});

describe('overlaps', () => {
  const day = (events: ReturnType<typeof makeEvent>[]) =>
    events.map((event) => ({ event, date: '2026-09-21' }));

  it('flags overlapping timed events only', () => {
    const ids = conflictingIds(
      day([
        makeEvent({ id: 'a', startTime: '09:00', endTime: '10:00' }),
        makeEvent({ id: 'b', startTime: '09:30', endTime: '11:00' }),
        makeEvent({ id: 'c', startTime: '11:00', endTime: '12:00' }),
        makeEvent({ id: 'd', allDay: true, startTime: '00:00' }),
      ]),
    );
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('puts overlapping events side by side', () => {
    const layout = layoutColumns(
      day([
        makeEvent({ id: 'a', startTime: '09:00', endTime: '10:00' }),
        makeEvent({ id: 'b', startTime: '09:30', endTime: '10:30' }),
        makeEvent({ id: 'c', startTime: '12:00', endTime: '13:00' }),
      ]),
    );
    expect(layout.get('a')).toEqual({ column: 0, columns: 2 });
    expect(layout.get('b')).toEqual({ column: 1, columns: 2 });
    expect(layout.get('c')).toEqual({ column: 0, columns: 1 });
  });
});

describe('labels', () => {
  it('describes times, repetition and reminders in pt-BR', () => {
    expect(eventTimeLabel({ allDay: false, startTime: '09:00', endTime: '10:30' })).toBe(
      '09:00 – 10:30',
    );
    expect(eventTimeLabel({ allDay: true, startTime: '00:00', endTime: null })).toBe('Dia inteiro');
    expect(repeatLabel('weekly', '2026-09-23')).toBe('Toda semana (quarta)');
    expect(repeatLabel('yearly', '2026-03-15')).toBe('Todo ano (15 de março)');
    expect(reminderLabel(30, false)).toBe('30 min antes');
    expect(reminderLabel(1440, true)).toBe('Na véspera, às 9h');
  });
});

describe('reminderMoment', () => {
  it('subtracts the lead time, crossing midnight when needed', () => {
    const event = makeEvent({ startTime: '00:10', reminderMinutes: 30 });
    expect(reminderMoment(event, '2026-09-21')).toEqual({
      date: '2026-09-20',
      hour: 23,
      minute: 40,
    });
    expect(
      reminderMoment(makeEvent({ allDay: true, reminderMinutes: 1440 }), '2026-09-21'),
    ).toEqual({ date: '2026-09-20', hour: 9, minute: 0 });
    expect(reminderMoment(makeEvent(), '2026-09-21')).toBeNull();
  });
});
