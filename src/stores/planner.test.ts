import { getRepositories, setRepositories } from '@/repositories';
import { createMemoryRepositories } from '@/repositories/memory';

import { plannerActions, usePlannerStore } from './plannerStore';

beforeEach(() => {
  setRepositories(createMemoryRepositories());
  usePlannerStore.setState({ version: 0 });
});

describe('plannerActions', () => {
  it('bumps the version after each write', async () => {
    await plannerActions.createTask({ title: 'A', date: '2026-09-21', priority: 'normal' });
    expect(usePlannerStore.getState().version).toBe(1);
  });

  it('rolls tasks over keeping the original day', async () => {
    const task = await plannerActions.createTask({
      title: ' Pagar conta ',
      date: '2026-09-20',
      priority: 'high',
    });
    expect(task.title).toBe('Pagar conta');
    expect(await getRepositories().tasks.listOverdue('2026-09-21')).toHaveLength(1);

    await plannerActions.moveTasks([task.id], '2026-09-21');
    await plannerActions.moveTasks([task.id], '2026-09-22');
    const moved = await getRepositories().tasks.getById(task.id);
    expect(moved).toMatchObject({ date: '2026-09-22', rolledFrom: '2026-09-20' });
    expect(await getRepositories().tasks.listOverdue('2026-09-21')).toHaveLength(0);
  });

  it('completed tasks are not overdue', async () => {
    const task = await plannerActions.createTask({
      title: 'A',
      date: '2026-09-20',
      priority: 'normal',
    });
    await plannerActions.setTaskCompleted(task.id, true);
    expect(await getRepositories().tasks.listOverdue('2026-09-21')).toHaveLength(0);
  });

  it('saves and clears the day note', async () => {
    await plannerActions.saveDayNote('2026-09-21', '  Dia bom  ');
    expect((await getRepositories().dayNotes.get('2026-09-21'))?.content).toBe('Dia bom');
    await plannerActions.saveDayNote('2026-09-21', '   ');
    expect(await getRepositories().dayNotes.get('2026-09-21')).toBeNull();
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
