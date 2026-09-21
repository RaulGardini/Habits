import { useMemo } from 'react';
import { create } from 'zustand';

import type { Habit, HabitDraft } from '@/core/habits/types';
import { moveItem, type MoveDirection } from '@/core/utils/reorder';
import { getRepositories } from '@/repositories';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface HabitsState {
  /** Active and archived habits, ordered by `sortOrder`. */
  habits: Habit[];
  status: LoadStatus;
  load(): Promise<void>;
  create(draft: HabitDraft): Promise<Habit>;
  update(id: string, draft: HabitDraft): Promise<Habit>;
  setArchived(id: string, archived: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  /** Moves an active habit one position up/down among active habits. */
  move(id: string, direction: MoveDirection): Promise<void>;
}

const bySortOrder = (a: Habit, b: Habit) => a.sortOrder - b.sortOrder;

export const useHabitsStore = create<HabitsState>()((set, get) => {
  const replace = (habit: Habit) =>
    set((state) => ({
      habits: state.habits.map((h) => (h.id === habit.id ? habit : h)).sort(bySortOrder),
    }));

  return {
    habits: [],
    status: 'idle',

    async load() {
      set({ status: 'loading' });
      try {
        set({ habits: await getRepositories().habits.list(), status: 'ready' });
      } catch (error) {
        set({ status: 'error' });
        throw error;
      }
    },

    async create(draft) {
      const habit = await getRepositories().habits.create(draft);
      set((state) => ({ habits: [...state.habits, habit].sort(bySortOrder) }));
      return habit;
    },

    async update(id, draft) {
      const habit = await getRepositories().habits.update(id, draft);
      replace(habit);
      return habit;
    },

    async setArchived(id, archived) {
      replace(await getRepositories().habits.setArchived(id, archived));
    },

    async remove(id) {
      await getRepositories().habits.remove(id);
      set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
    },

    async move(id, direction) {
      const previous = get().habits;
      const active = previous.filter((h) => h.archivedAt === null).map((h) => h.id);
      const archived = previous.filter((h) => h.archivedAt !== null).map((h) => h.id);
      const orderedIds = [...moveItem(active, id, direction), ...archived];
      const position = new Map(orderedIds.map((habitId, index) => [habitId, index]));

      // Optimistic: reorder locally first, roll back if persisting fails.
      set({
        habits: previous
          .map((h) => ({ ...h, sortOrder: position.get(h.id) ?? h.sortOrder }))
          .sort(bySortOrder),
      });
      try {
        await getRepositories().habits.reorder(orderedIds);
      } catch (error) {
        set({ habits: previous });
        throw error;
      }
    },
  };
});

/**
 * Non-archived habits. Use with `getState()` only: as a hook selector it would return a new
 * array on every call (infinite re-render in Zustand v5). In components use `useActiveHabits()`.
 */
export const selectActiveHabits = (state: HabitsState) =>
  state.habits.filter((h) => h.archivedAt === null);

/** Non-archived habits, memoized. */
export function useActiveHabits(): Habit[] {
  const habits = useHabitsStore((state) => state.habits);
  return useMemo(() => habits.filter((h) => h.archivedAt === null), [habits]);
}
