import type { HabitDraft } from '@/core/habits/types';
import { createMemoryRepositories } from '@/repositories/memory';

import { applyWidgetAction, loadWidgetSnapshot } from './data';

const draft = (patch: Partial<HabitDraft>): HabitDraft => ({
  name: 'Ler',
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: [],
  ...patch,
});

const today = '2026-09-21';

describe('widget data', () => {
  it('toggles yes/no habits and increments quantity habits', async () => {
    const repos = createMemoryRepositories();
    const read = await repos.habits.create(draft({}));
    const water = await repos.habits.create(
      draft({ name: 'Água', tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.5 } }),
    );

    expect(await applyWidgetAction(repos, read.id, today)).toBe(true);
    expect(await applyWidgetAction(repos, water.id, today)).toBe(true);
    let snapshot = await loadWidgetSnapshot(repos, today);
    expect(snapshot.habits.map((h) => [h.name, h.done, h.detail])).toEqual([
      ['Ler', true, ''],
      ['Água', false, '0,5 / 2 L'],
    ]);

    await applyWidgetAction(repos, read.id, today);
    snapshot = await loadWidgetSnapshot(repos, today);
    expect(snapshot.habits[0]?.done).toBe(false);
  });

  it('ignores timers and unknown habits', async () => {
    const repos = createMemoryRepositories();
    const timer = await repos.habits.create(
      draft({ tracking: { type: 'timer', targetSeconds: 600 } }),
    );
    expect(await applyWidgetAction(repos, timer.id, today)).toBe(false);
    expect(await applyWidgetAction(repos, 'nope', today)).toBe(false);
  });

  it('respects the first day of the week setting', async () => {
    const repos = createMemoryRepositories();
    await repos.settings.set('weekStartsOn', 1);
    expect((await loadWidgetSnapshot(repos, today)).weekStartsOn).toBe(1);
  });
});
