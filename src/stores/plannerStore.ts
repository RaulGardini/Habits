import { useEffect, useState } from 'react';
import { create } from 'zustand';

import type { LocalDate } from '@/core/dates/localDate';
import type { EventDraft, GoalDraft, GoalScope } from '@/core/planner/types';
import { getRepositories } from '@/repositories';
import { useAsyncError } from '@/lib/useAsyncError';

interface PlannerState {
  /** Incremented after every agenda/goal change; queries refetch when it changes. */
  version: number;
  bump(): void;
}

export const usePlannerStore = create<PlannerState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

/**
 * Runs a repository read and re-runs it when its arguments or the planner version change.
 * Keeps the previous value while refetching the same query (no flicker). `null` = loading; a
 * failure goes to the screen's error boundary.
 * `fetcher` must be a stable (module-level) function.
 */
function useRepoQuery<A extends unknown[], T>(
  fetcher: (...args: A) => Promise<T>,
  ...args: A
): T | null {
  const version = usePlannerStore((state) => state.version);
  const key = JSON.stringify(args);
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const fail = useAsyncError('Planner query failed');

  useEffect(() => {
    let cancelled = false;
    fetcher(...(JSON.parse(key) as A))
      .then((value) => {
        if (!cancelled) setState({ key, value });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, key, version, fail]);

  return state?.key === key ? state.value : null;
}

const repos = () => getRepositories();
const fetchEvents = (from: LocalDate, to: LocalDate) => repos().events.listByRange(from, to);
// Boxed, so that "not found" (null) is not mistaken for "loading".
const fetchEvent = async (id: string) => ({ value: await repos().events.getById(id) });
const fetchGoals = (scope: GoalScope, period: string) => repos().goals.listByPeriod(scope, period);
const fetchGoal = async (id: string) => ({ value: await repos().goals.getById(id) });

export const useEvents = (from: LocalDate, to: LocalDate) => useRepoQuery(fetchEvents, from, to);
/** `undefined` while loading, `null` when the event does not exist (e.g. deleted elsewhere). */
export const useEvent = (id: string) => useRepoQuery(fetchEvent, id)?.value;
export const useGoals = (scope: GoalScope, period: string) =>
  useRepoQuery(fetchGoals, scope, period);
/** `undefined` while loading, `null` when the goal does not exist (e.g. deleted elsewhere). */
export const useGoal = (id: string) => useRepoQuery(fetchGoal, id)?.value;

/** Runs a write and refreshes every planner query. */
async function mutate<T>(write: () => Promise<T>): Promise<T> {
  const result = await write();
  usePlannerStore.getState().bump();
  return result;
}

export const plannerActions = {
  createEvent: (draft: EventDraft) => mutate(() => repos().events.create(draft)),
  updateEvent: (id: string, draft: EventDraft) => mutate(() => repos().events.update(id, draft)),
  removeEvent: (id: string) => mutate(() => repos().events.remove(id)),

  createGoal: (draft: GoalDraft) => mutate(() => repos().goals.create(draft)),
  updateGoal: (id: string, draft: GoalDraft) => mutate(() => repos().goals.update(id, draft)),
  setGoalCurrent: (id: string, current: number) =>
    mutate(() => repos().goals.setCurrent(id, current)),
  removeGoal: (id: string) => mutate(() => repos().goals.remove(id)),
};
