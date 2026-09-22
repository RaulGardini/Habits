import { newEventDraft } from '@/core/planner/agenda';
import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { plannerActions, usePlannerStore } from './plannerStore';

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  usePlannerStore.setState({ version: 0 });
});

describe('plannerActions', () => {
  it('bumps the version after each write', async () => {
    await plannerActions.createEvent({ ...newEventDraft('2026-09-21'), title: 'A' });
    expect(usePlannerStore.getState().version).toBe(1);
  });

  it('removes one day of a series without touching the others', async () => {
    const event = await plannerActions.createEvent({
      ...newEventDraft('2026-09-01'),
      title: 'Academia',
      repeat: 'weekly',
    });
    await plannerActions.updateEvent(event.id, { ...event, excludedDates: ['2026-09-08'] });
    const [stored] = await getRepositories().events.listByRange('2026-09-08', '2026-09-15');
    expect(stored?.excludedDates).toEqual(['2026-09-08']);
    await plannerActions.removeEvent(event.id);
    expect(await getRepositories().events.listByRange('2026-09-01', '2026-12-31')).toEqual([]);
  });

  it('creates goals and updates manual progress', async () => {
    const goal = await plannerActions.createGoal({
      title: 'Ler livros',
      scope: 'year',
      period: '2026',
      target: 12,
      unit: 'livros',
      habitId: null,
    });
    await plannerActions.setGoalCurrent(goal.id, 3);
    await plannerActions.setGoalCurrent(goal.id, -5);
    const goals = await getRepositories().goals.listByPeriod('year', '2026');
    expect(goals).toHaveLength(1);
    expect(goals[0]?.current).toBe(0);
  });
});
