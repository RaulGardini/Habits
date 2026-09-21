import { toggleEntry } from '@/core/habits/entries';
import type { HabitDraft } from '@/core/habits/types';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { useEntriesStore } from './entriesStore';
import { selectActiveHabits, useHabitsStore } from './habitsStore';
import { useSettingsStore } from './settingsStore';
import { elapsedSeconds, useTimerStore } from './timerStore';

const draft = (name: string, patch: Partial<HabitDraft> = {}): HabitDraft => ({
  name,
  icon: 'star',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
  ...patch,
});

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  useHabitsStore.setState({ habits: [], status: 'idle' });
  useEntriesStore.setState({ byDate: {}, version: 0 });
  useSettingsStore.setState({ themePreference: 'system', weekStartsOn: 0 });
  useTimerStore.setState({ active: null });
});

describe('habitsStore', () => {
  it('creates habits at the end of the list', async () => {
    await useHabitsStore.getState().create(draft('A'));
    await useHabitsStore.getState().create(draft('B'));
    expect(useHabitsStore.getState().habits.map((h) => [h.name, h.sortOrder])).toEqual([
      ['A', 0],
      ['B', 1],
    ]);
  });

  it('keeps frequency, tracking and sorted reminders', async () => {
    const habit = await useHabitsStore.getState().create(
      draft('Água', {
        frequency: { type: 'weekdays', days: 0b10 },
        tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.25 },
        reminders: ['20:00', '08:00'],
      }),
    );
    expect(habit.frequency).toEqual({ type: 'weekdays', days: 0b10 });
    expect(habit.tracking).toEqual({ type: 'quantity', target: 2, unit: 'L', step: 0.25 });
    expect(habit.reminders).toEqual(['08:00', '20:00']);
  });

  it('moves among active habits and persists the order', async () => {
    const store = useHabitsStore.getState();
    await store.create(draft('A'));
    const b = await store.create(draft('B'));
    const c = await store.create(draft('C'));
    await store.setArchived(b.id, true);

    await store.move(c.id, 'up');

    const names = (habits: { name: string }[]) => habits.map((h) => h.name);
    expect(names(selectActiveHabits(useHabitsStore.getState()))).toEqual(['C', 'A']);
    await useHabitsStore.getState().load();
    expect(names(selectActiveHabits(useHabitsStore.getState()))).toEqual(['C', 'A']);
  });

  it('rolls back the order when persisting fails', async () => {
    const store = useHabitsStore.getState();
    await store.create(draft('A'));
    const b = await store.create(draft('B'));
    jest.spyOn(getRepositories().habits, 'reorder').mockRejectedValueOnce(new Error('disk full'));

    await expect(store.move(b.id, 'up')).rejects.toThrow('disk full');
    expect(useHabitsStore.getState().habits.map((h) => h.name)).toEqual(['A', 'B']);
  });

  it('archives without losing the habit', async () => {
    const habit = await useHabitsStore.getState().create(draft('A'));
    await useHabitsStore.getState().setArchived(habit.id, true);
    expect(selectActiveHabits(useHabitsStore.getState())).toHaveLength(0);
    expect(useHabitsStore.getState().habits).toHaveLength(1);
  });
});

describe('entriesStore.save', () => {
  const date = '2026-09-21';
  const entryOf = () => useEntriesStore.getState().byDate[date]?.h1;

  it('marks as done and then clears', async () => {
    await useEntriesStore.getState().save('h1', date, toggleEntry(entryOf()));
    expect(entryOf()?.status).toBe('done');
    expect(await getRepositories().entries.listByDate(date)).toHaveLength(1);

    await useEntriesStore.getState().save('h1', date, toggleEntry(entryOf()));
    expect(entryOf()).toBeUndefined();
    expect(await getRepositories().entries.listByDate(date)).toHaveLength(0);
  });

  it('bumps the version after each change', async () => {
    await useEntriesStore.getState().save('h1', date, { status: 'done' });
    expect(useEntriesStore.getState().version).toBe(1);
  });

  it('rolls back when saving fails', async () => {
    jest.spyOn(getRepositories().entries, 'upsert').mockRejectedValueOnce(new Error('disk full'));
    await expect(useEntriesStore.getState().save('h1', date, { status: 'done' })).rejects.toThrow(
      'disk full',
    );
    expect(entryOf()).toBeUndefined();
    expect(useEntriesStore.getState().version).toBe(0);
  });

  it('loads a day from the repository', async () => {
    await getRepositories().entries.upsert('h2', date, { status: 'done' });
    await useEntriesStore.getState().loadDate(date);
    expect(useEntriesStore.getState().byDate[date]?.h2?.status).toBe('done');
  });
});

describe('timerStore', () => {
  afterEach(() => jest.useRealTimers());

  it('accumulates elapsed time into the entry when stopped', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 21, 10, 0, 0) });
    const habit = await useHabitsStore
      .getState()
      .create(draft('Ler', { tracking: { type: 'timer', targetSeconds: 600 } }));
    const date = '2026-09-21';

    await useTimerStore.getState().start(habit, date);
    jest.setSystemTime(new Date(2026, 8, 21, 10, 4, 0));
    await useTimerStore.getState().stop();
    expect(useEntriesStore.getState().byDate[date]?.[habit.id]).toMatchObject({
      status: 'partial',
      value: 240,
    });

    await useTimerStore.getState().start(habit, date);
    jest.setSystemTime(new Date(2026, 8, 21, 10, 11, 0));
    await useTimerStore.getState().stop();
    expect(useEntriesStore.getState().byDate[date]?.[habit.id]).toMatchObject({
      status: 'done',
      value: 660,
    });
    expect(useTimerStore.getState().active).toBeNull();
  });

  it('persists the running timer', async () => {
    const habit = await useHabitsStore
      .getState()
      .create(draft('Ler', { tracking: { type: 'timer', targetSeconds: 600 } }));
    await useTimerStore.getState().start(habit, '2026-09-21');
    useTimerStore.setState({ active: null });
    await useTimerStore.getState().load();
    expect(useTimerStore.getState().active?.habitId).toBe(habit.id);
  });

  it('computes elapsed seconds', () => {
    expect(
      elapsedSeconds({ habitId: 'h', date: '2026-09-21', startedAt: 0, baseSeconds: 30 }, 90_500),
    ).toBe(120);
  });
});

describe('settingsStore', () => {
  it('persists the theme preference and the first day of the week', async () => {
    await useSettingsStore.getState().setThemePreference('dark');
    await useSettingsStore.getState().setWeekStartsOn(1);
    useSettingsStore.setState({ themePreference: 'system', weekStartsOn: 0 });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState()).toMatchObject({ themePreference: 'dark', weekStartsOn: 1 });
  });
});
