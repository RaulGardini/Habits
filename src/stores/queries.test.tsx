import { renderHook, waitFor } from '@testing-library/react-native';
import { Component, type ReactNode } from 'react';

import { newEventDraft } from '@/core/planner/agenda';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { useDayEntries, useEntriesStore } from './entriesStore';
import { plannerActions, useEvent, useEvents, usePlannerStore } from './plannerStore';

jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

/** Stands in for the screen error boundary (`ScreenErrorFallback`). */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  static caught: Error | null = null;
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    Boundary.caught = error;
    return { error };
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  usePlannerStore.setState({ version: 0 });
  useEntriesStore.getState().reset();
  Boundary.caught = null;
  // React reports errors caught by a boundary; here they are on purpose.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('tells a missing event apart from a found one', async () => {
  const event = await plannerActions.createEvent({ ...newEventDraft('2026-09-21'), title: 'A' });
  const found = await renderHook(() => useEvent(event.id));
  await waitFor(() => expect(found.result.current?.title).toBe('A'));

  // Deleted on another device: "not found" instead of "Carregando…" forever.
  const missing = await renderHook(() => useEvent('deleted-elsewhere'));
  await waitFor(() => expect(missing.result.current).toBeNull());
});

it('hands a failed query to the error boundary instead of loading forever', async () => {
  jest
    .spyOn(getRepositories().events, 'listByRange')
    .mockRejectedValue(new Error('disk I/O error'));
  await renderHook(() => useEvents('2026-09-01', '2026-09-30'), { wrapper: Boundary });
  await waitFor(() => expect(Boundary.caught?.message).toBe('disk I/O error'));
});

it('hands a failed day load to the error boundary', async () => {
  jest.spyOn(getRepositories().entries, 'listByDate').mockRejectedValue(new Error('locked'));
  await renderHook(() => useDayEntries('2026-09-23'), { wrapper: Boundary });
  await waitFor(() => expect(Boundary.caught?.message).toBe('locked'));
});
