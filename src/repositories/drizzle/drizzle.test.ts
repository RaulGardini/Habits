import { newEventDraft } from '@/core/planner/agenda';
import type { HabitDraft } from '@/core/habits/types';
import { createTestDatabase } from '@/db/testing';

import type { Repositories } from '../types';
import { createDrizzleRepositories } from './index';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

const draft = (patch: Partial<HabitDraft> = {}): HabitDraft => ({
  name: 'Beber água',
  icon: 'cup-water',
  color: 'blue',
  timeOfDay: 'morning',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
  ...patch,
});

let repos: Repositories;

beforeEach(async () => {
  repos = createDrizzleRepositories(await createTestDatabase());
});

describe('habits (Drizzle + real SQLite)', () => {
  it('stores every frequency and tracking type', async () => {
    const created = await repos.habits.create(
      draft({
        frequency: { type: 'per_period', count: 3, period: 'week' },
        tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.25 },
        reminders: ['20:00', '08:00'],
      }),
    );
    const loaded = await repos.habits.getById(created.id);
    expect(loaded).toMatchObject({
      frequency: { type: 'per_period', count: 3, period: 'week' },
      tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.25 },
      reminders: ['08:00', '20:00'],
    });
  });

  it('updates reminders without duplicating rows', async () => {
    const habit = await repos.habits.create(draft({ reminders: ['08:00', '12:00'] }));
    await repos.habits.update(habit.id, draft({ reminders: ['12:00', '21:00'] }));
    expect((await repos.habits.getById(habit.id))?.reminders).toEqual(['12:00', '21:00']);
  });

  it('orders, archives and soft-deletes', async () => {
    const a = await repos.habits.create(draft({ name: 'A' }));
    const b = await repos.habits.create(draft({ name: 'B' }));
    await repos.habits.reorder([b.id, a.id]);
    expect((await repos.habits.list()).map((h) => h.name)).toEqual(['B', 'A']);
    await repos.habits.setArchived(a.id, true);
    expect((await repos.habits.getById(a.id))?.archivedAt).not.toBeNull();
    await repos.habits.remove(b.id);
    expect((await repos.habits.list()).map((h) => h.name)).toEqual(['A']);
  });
});

describe('entries', () => {
  it('upserts one entry per habit per day and revives soft-deleted ones', async () => {
    const habit = await repos.habits.create(draft());
    await repos.entries.upsert(habit.id, '2026-09-21', { status: 'partial', value: 1 });
    await repos.entries.upsert(habit.id, '2026-09-21', { status: 'done', value: 2, note: 'ok' });
    expect(await repos.entries.listByDate('2026-09-21')).toHaveLength(1);

    await repos.entries.remove(habit.id, '2026-09-21');
    expect(await repos.entries.listByDate('2026-09-21')).toHaveLength(0);

    const revived = await repos.entries.upsert(habit.id, '2026-09-21', { status: 'skipped' });
    expect(revived).toMatchObject({ status: 'skipped', value: null, note: null });
    expect(await repos.entries.listByHabit(habit.id)).toHaveLength(1);
  });

  it('lists ranges in date order', async () => {
    const habit = await repos.habits.create(draft());
    for (const date of ['2026-09-03', '2026-09-01', '2026-09-10']) {
      await repos.entries.upsert(habit.id, date, { status: 'done' });
    }
    const range = await repos.entries.listByRange('2026-09-01', '2026-09-05');
    expect(range.map((e) => e.date)).toEqual(['2026-09-01', '2026-09-03']);
  });
});

describe('settings', () => {
  it('stores JSON values', async () => {
    await repos.settings.set('weekStartsOn', 1);
    await repos.settings.set('weekStartsOn', 0);
    expect(await repos.settings.get<number>('weekStartsOn')).toBe(0);
    expect(await repos.settings.get('missing')).toBeNull();
  });
});

describe('planner', () => {
  it('handles tasks, rollover and overdue', async () => {
    const task = await repos.tasks.create({ title: 'Pagar', date: '2026-09-20', priority: 'high' });
    expect(await repos.tasks.listOverdue('2026-09-21')).toHaveLength(1);
    await repos.tasks.moveToDate([task.id], '2026-09-21');
    expect(await repos.tasks.getById(task.id)).toMatchObject({
      date: '2026-09-21',
      rolledFrom: '2026-09-20',
    });
    await repos.tasks.setCompleted(task.id, true);
    expect((await repos.tasks.getById(task.id))?.completedAt).not.toBeNull();
  });

  it('saves, revives and clears day notes', async () => {
    await repos.dayNotes.save('2026-09-21', 'Olá');
    await repos.dayNotes.save('2026-09-21', '');
    expect(await repos.dayNotes.get('2026-09-21')).toBeNull();
    await repos.dayNotes.save('2026-09-21', 'De novo');
    expect((await repos.dayNotes.get('2026-09-21'))?.content).toBe('De novo');
  });

  it('stores events and goals', async () => {
    await repos.events.create({
      ...newEventDraft('2026-09-21'),
      title: 'Reunião',
      endTime: '10:00',
      note: ' ',
    });
    const [event] = await repos.events.listByRange('2026-09-21', '2026-09-21');
    expect(event).toMatchObject({ title: 'Reunião', note: null, allDay: false, excludedDates: [] });

    // Recurring series started before the range are listed; ended ones are not.
    await repos.events.create({
      ...newEventDraft('2026-01-05'),
      title: 'Academia',
      repeat: 'weekly',
      excludedDates: ['2026-09-28', '2026-09-21'],
    });
    await repos.events.create({
      ...newEventDraft('2026-01-01'),
      title: 'Curso',
      repeat: 'daily',
      repeatUntil: '2026-03-01',
    });
    const inOctober = await repos.events.listByRange('2026-09-28', '2026-10-04');
    expect(inOctober.map((e) => e.title)).toEqual(['Academia']);
    expect(inOctober[0]?.excludedDates).toEqual(['2026-09-21', '2026-09-28']);

    const allDay = await repos.events.create({
      ...newEventDraft('2026-09-22'),
      title: 'Feriado',
      allDay: true,
    });
    expect(allDay).toMatchObject({ allDay: true, startTime: '00:00', endTime: null });

    const goal = await repos.goals.create({
      title: 'Livros',
      scope: 'year',
      period: '2026',
      target: 12,
      unit: 'livros',
      habitId: null,
    });
    await repos.goals.setCurrent(goal.id, 4);
    expect((await repos.goals.listByPeriod('year', '2026'))[0]?.current).toBe(4);
  });
});

describe('backup', () => {
  async function seed(target: Repositories) {
    const habit = await target.habits.create(draft({ reminders: ['08:00'] }));
    await target.entries.upsert(habit.id, '2026-09-21', { status: 'done' });
    await target.tasks.create({ title: 'Tarefa', date: '2026-09-21', priority: 'normal' });
    await target.dayNotes.save('2026-09-21', 'Nota');
    await target.settings.set('theme', 'dark');
    return habit;
  }

  it('exports everything and restores it into an empty database', async () => {
    const habit = await seed(repos);
    const exported = await repos.backup.exportAll();

    const fresh = createDrizzleRepositories(await createTestDatabase());
    const summary = await fresh.backup.importMerge(exported);
    expect(summary).toEqual({ inserted: 6, updated: 0, skipped: 0 });
    expect(await fresh.habits.getById(habit.id)).toMatchObject({ reminders: ['08:00'] });
    expect(await fresh.entries.listByDate('2026-09-21')).toHaveLength(1);
    expect((await fresh.dayNotes.get('2026-09-21'))?.content).toBe('Nota');
    expect(await fresh.settings.get('theme')).toBe('dark');
  });

  it('merging the same backup twice changes nothing', async () => {
    await seed(repos);
    const exported = await repos.backup.exportAll();
    const summary = await repos.backup.importMerge(exported);
    expect(summary).toEqual({ inserted: 0, updated: 0, skipped: 6 });
  });

  it('newer rows win and entries are matched by habit and day', async () => {
    const habit = await seed(repos);
    const exported = await repos.backup.exportAll();
    const entry = exported.habitEntries[0]!;
    exported.habitEntries = [
      { ...entry, id: 'other-device-id', status: 'skipped', updatedAt: '2999-01-01T00:00:00.000Z' },
    ];
    const summary = await repos.backup.importMerge(exported);
    expect(summary.updated).toBe(1);
    const [local] = await repos.entries.listByDate('2026-09-21');
    expect(local).toMatchObject({ id: entry.id, habitId: habit.id, status: 'skipped' });
  });

  it('skips entries of unknown habits instead of failing', async () => {
    await seed(repos);
    const exported = await repos.backup.exportAll();
    exported.habitEntries.push({ ...exported.habitEntries[0]!, id: 'orphan', habitId: 'nope' });
    const fresh = createDrizzleRepositories(await createTestDatabase());
    const summary = await fresh.backup.importMerge(exported);
    expect(summary.skipped).toBe(1);
  });

  it('deletes all data', async () => {
    await seed(repos);
    await repos.backup.deleteAll();
    const exported = await repos.backup.exportAll();
    expect(Object.values(exported).every((rows) => rows.length === 0)).toBe(true);
  });
});
