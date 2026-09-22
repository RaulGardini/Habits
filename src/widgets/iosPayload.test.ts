import type { WidgetSnapshot } from '@/core/widgets/snapshot';

import { parsePendingActions, toIosPayload } from './iosPayload';

const snapshot: WidgetSnapshot = {
  date: '2026-09-21',
  completed: 1,
  total: 2,
  habits: [
    {
      id: 'h',
      name: 'Ler',
      color: 'violet',
      done: true,
      progress: 1,
      detail: '',
      action: 'toggle',
    },
  ],
  heatmap: [[1, -1, 0, 0, 0, 0, 0]],
  weekStartsOn: 0,
};

describe('toIosPayload', () => {
  it('resolves habit and theme colors for both schemes', () => {
    const payload = toIosPayload(snapshot);
    expect(payload.habits[0]?.light.solid).toBe('#7c3aed');
    expect(payload.habits[0]?.dark.solid).toBe('#a78bfa');
    expect(payload.light.background).toBe('#fffdf8');
    expect(payload.dark.background).toBe('#201d18');
    expect(payload.heatmap).toEqual(snapshot.heatmap);
  });
});

describe('parsePendingActions', () => {
  it('parses the queue and drops invalid items', () => {
    expect(
      parsePendingActions(
        JSON.stringify([{ habitId: 'a', date: '2026-09-21' }, { habitId: 1 }, null]),
      ),
    ).toEqual([{ habitId: 'a', date: '2026-09-21' }]);
  });

  it('returns [] for empty or broken content', () => {
    expect(parsePendingActions(null)).toEqual([]);
    expect(parsePendingActions('{')).toEqual([]);
    expect(parsePendingActions('{"a":1}')).toEqual([]);
  });
});
