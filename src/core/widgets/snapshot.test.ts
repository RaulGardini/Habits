import { makeEntry, makeHabit } from '@/core/habits/testing';

import {
  WIDGET_HEATMAP_WEEKS,
  WIDGET_MAX_HABITS,
  buildWidgetSnapshot,
  heatmapSvg,
  widgetHeatmapStart,
} from './snapshot';

const today = '2026-09-21'; // Monday

describe('buildWidgetSnapshot', () => {
  const water = makeHabit({
    id: 'w',
    name: 'Água',
    color: 'blue',
    tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.5 },
  });
  const read = makeHabit({ id: 'r', name: 'Ler', sortOrder: 1 });
  const meditate = makeHabit({
    id: 'm',
    name: 'Meditar',
    sortOrder: 2,
    tracking: { type: 'timer', targetSeconds: 600 },
  });

  it('lists due habits with status, detail and quick action', () => {
    const snapshot = buildWidgetSnapshot(
      [water, read, meditate],
      [
        makeEntry({ habitId: 'w', date: today, status: 'partial', value: 1 }),
        makeEntry({ habitId: 'r', date: today, status: 'done' }),
      ],
      today,
      0,
    );
    expect(snapshot).toMatchObject({ date: today, completed: 1, total: 3 });
    expect(snapshot.habits).toEqual([
      {
        id: 'w',
        name: 'Água',
        color: 'blue',
        done: false,
        progress: 0.5,
        detail: '1 / 2 L',
        action: 'increment',
      },
      {
        id: 'r',
        name: 'Ler',
        color: 'blue',
        done: true,
        progress: 1,
        detail: '',
        action: 'toggle',
      },
      {
        id: 'm',
        name: 'Meditar',
        color: 'blue',
        done: false,
        progress: 0,
        detail: '00:00 / 10 min',
        action: 'open',
      },
    ]);
  });

  it('limits the number of habits', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeHabit({ id: `h${i}`, sortOrder: i }));
    expect(buildWidgetSnapshot(many, [], today, 0).habits).toHaveLength(WIDGET_MAX_HABITS);
  });

  it('builds a weeks × 7 heatmap ending in the current week', () => {
    const snapshot = buildWidgetSnapshot(
      [read],
      [makeEntry({ habitId: 'r', date: '2026-09-20', status: 'done' })],
      today,
      0,
    );
    expect(snapshot.heatmap).toHaveLength(WIDGET_HEATMAP_WEEKS);
    const lastWeek = snapshot.heatmap[WIDGET_HEATMAP_WEEKS - 1]!;
    // Week of 20–26 Sep (Sunday first): Sunday done, Monday (today) pending, rest future.
    expect(lastWeek).toEqual([1, -1, -1, -1, -1, -1, -1]);
  });
});

describe('widgetHeatmapStart', () => {
  it('starts on the first day of the week, 11 weeks before the current one', () => {
    expect(widgetHeatmapStart(today, 0)).toBe('2026-07-05');
    expect(widgetHeatmapStart(today, 1)).toBe('2026-07-06');
  });
});

describe('heatmapSvg', () => {
  it('draws one rect per day with intensity levels', () => {
    const svg = heatmapSvg([[1, 0, -1, 0.3, 0.5, 0.7, 0.1]], {
      color: '#4f46e5',
      empty: '#eeeeee',
      outline: '#cccccc',
    });
    expect(svg.match(/<rect/g)).toHaveLength(7);
    expect(svg).toContain('fill="none" stroke="#cccccc"');
    expect(svg).toContain('fill="#eeeeee"');
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).toContain('fill-opacity="0.3"');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});
