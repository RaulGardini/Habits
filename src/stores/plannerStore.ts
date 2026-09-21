import { useEffect, useState } from 'react';
import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import type { EventDraft, GoalDraft, GoalScope, TaskDraft } from '@/core/planner/types';
import { getRepositories } from '@/repositories';

interface PlannerState {
  /** Incremented after every planner change; queries refetch when it changes. */
  version: number;
  bump(): void;
}

export const usePlannerStore = create<PlannerState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

/**
 * Runs a repository read and re-runs it when its arguments or the planner version change.
 * Keeps the previous value while refetching the same query (no flicker). `null` = loading.
 * `fetcher` must be a stable (module-level) function.
 */
function useRepoQuery<A extends unknown[], T>(
  fetcher: (...args: A) => Promise<T>,
  ...args: A
): T | null {
  const version = usePlannerStore((state) => state.version);
  const key = JSON.stringify(args);
  const [state, setState] = useState<{ key: string; value: T } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher(...(JSON.parse(key) as A))
      .then((value) => {
        if (!cancelled) setState({ key, value });
      })
      .catch((error: unknown) => console.error('Planner query failed', error));
    return () => {
      cancelled = true;
    };
  }, [fetcher, key, version]);

  return state?.key === key ? state.value : null;
}

const repos = () => getRepositories();
const fetchTasks = (from: LocalDate, to: LocalDate) => repos().tasks.listByRange(from, to);
const fetchOverdue = (date: LocalDate) => repos().tasks.listOverdue(date);
const fetchTask = (id: string) => repos().tasks.getById(id);
const fetchEvents = (from: LocalDate, to: LocalDate) => repos().events.listByRange(from, to);
const fetchEvent = (id: string) => repos().events.getById(id);
// Wrapped so "no note" (null) is distinguishable from "loading" (query result null).
const fetchDayNote = async (date: LocalDate) => ({ note: await repos().dayNotes.get(date) });
const fetchGoals = (scope: GoalScope, period: string) => repos().goals.listByPeriod(scope, period);
const fetchGoal = (id: string) => repos().goals.getById(id);

export const useTasks = (from: LocalDate, to: LocalDate) => useRepoQuery(fetchTasks, from, to);
export const useOverdueTasks = (date: LocalDate) => useRepoQuery(fetchOverdue, date);
export const useTask = (id: string) => useRepoQuery(fetchTask, id);
export const useEvents = (from: LocalDate, to: LocalDate) => useRepoQuery(fetchEvents, from, to);
export const useEvent = (id: string) => useRepoQuery(fetchEvent, id);
/** `undefined` while loading, `null` when the day has no note. */
export const useDayNote = (date: LocalDate) => useRepoQuery(fetchDayNote, date)?.note;
export const useGoals = (scope: GoalScope, period: string) =>
  useRepoQuery(fetchGoals, scope, period);
export const useGoal = (id: string) => useRepoQuery(fetchGoal, id);

/** Runs a write and refreshes every planner query. */
async function mutate<T>(write: () => Promise<T>): Promise<T> {
  const result = await write();
  usePlannerStore.getState().bump();
  return result;
}

export const plannerActions = {
  createTask: (draft: TaskDraft) => mutate(() => repos().tasks.create(draft)),
  updateTask: (id: string, draft: TaskDraft) => mutate(() => repos().tasks.update(id, draft)),
  setTaskCompleted: (id: string, completed: boolean) =>
    mutate(() => repos().tasks.setCompleted(id, completed)),
  moveTasks: (ids: readonly string[], date: LocalDate) =>
    mutate(() => repos().tasks.moveToDate(ids, date)),
  removeTask: (id: string) => mutate(() => repos().tasks.remove(id)),

  createEvent: (draft: EventDraft) => mutate(() => repos().events.create(draft)),
  updateEvent: (id: string, draft: EventDraft) => mutate(() => repos().events.update(id, draft)),
  removeEvent: (id: string) => mutate(() => repos().events.remove(id)),

  saveDayNote: (date: LocalDate, content: string) =>
    mutate(() => repos().dayNotes.save(date, content)),

  createGoal: (draft: GoalDraft) => mutate(() => repos().goals.create(draft)),
  updateGoal: (id: string, draft: GoalDraft) => mutate(() => repos().goals.update(id, draft)),
  setGoalCurrent: (id: string, current: number) =>
    mutate(() => repos().goals.setCurrent(id, current)),
  removeGoal: (id: string) => mutate(() => repos().goals.remove(id)),
};
