import type { HabitDraft } from '@/core/habits/types';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { useEntriesStore } from './entriesStore';
import { selectActiveHabits, useHabitsStore } from './habitsStore';
import { useSettingsStore } from './settingsStore';

const draft = (name: string): HabitDraft => ({
  name,
  icon: 'star',
  color: 'blue',
  timeOfDay: 'anytime',
  startDate: '2026-09-01',
});

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  useHabitsStore.setState({ habits: [], status: 'idle' });
  useEntriesStore.setState({ byDate: {} });
  useSettingsStore.setState({ themePreference: 'system' });
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

describe('entriesStore.toggle', () => {
  const date = '2026-09-21';

  it('marks as done and then clears', async () => {
    await useEntriesStore.getState().toggle('h1', date);
    expect(useEntriesStore.getState().byDate[date]?.h1?.status).toBe('done');
    expect(await getRepositories().entries.listByDate(date)).toHaveLength(1);

    await useEntriesStore.getState().toggle('h1', date);
    expect(useEntriesStore.getState().byDate[date]?.h1).toBeUndefined();
    expect(await getRepositories().entries.listByDate(date)).toHaveLength(0);
  });

  it('rolls back when saving fails', async () => {
    jest.spyOn(getRepositories().entries, 'upsert').mockRejectedValueOnce(new Error('disk full'));
    await expect(useEntriesStore.getState().toggle('h1', date)).rejects.toThrow('disk full');
    expect(useEntriesStore.getState().byDate[date]?.h1).toBeUndefined();
  });

  it('loads a day from the repository', async () => {
    await getRepositories().entries.upsert('h2', date, { status: 'done' });
    await useEntriesStore.getState().loadDate(date);
    expect(useEntriesStore.getState().byDate[date]?.h2?.status).toBe('done');
  });
});

describe('settingsStore', () => {
  it('persists the theme preference', async () => {
    await useSettingsStore.getState().setThemePreference('dark');
    useSettingsStore.setState({ themePreference: 'system' });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });
});
