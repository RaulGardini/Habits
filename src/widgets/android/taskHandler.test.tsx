import { isValidElement, type ReactElement, type ReactNode } from 'react';

import { addDaysLocal, todayLocal } from '@/core/dates/localDate';
import type { HabitDraft } from '@/core/habits/types';
import { createMemoryRepositories } from '@/repositories/memory';
import type { Repositories } from '@/repositories';
import { rescheduleReminders } from '@/stores/reminders';

import { widgetTaskHandler } from './taskHandler';
import { HABIT_ACTION, HEATMAP_WIDGET, TODAY_WIDGET } from './widgets';

// The real primitives are native views; plain tags are enough to walk the tree.
jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
  SvgWidget: 'SvgWidget',
}));
let mockRepos: Repositories;
jest.mock('@/db/init', () => ({ initRepositories: async () => mockRepos }));
const mockOrder: string[] = [];
jest.mock('@/stores/reminders', () => ({
  rescheduleReminders: jest.fn(async () => void mockOrder.push('reminders')),
}));

/**
 * Expands function components the way react-native-android-widget does (plain calls, no React
 * renderer) and collects the texts: running the real widget code end to end.
 */
function texts(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ text?: string; children?: ReactNode }>;
  if (typeof element.type === 'function') {
    return texts((element.type as (props: object) => ReactNode)(element.props));
  }
  const own = element.props.text ? [element.props.text] : [];
  return [...own, ...texts(element.props.children)];
}

const draft: HabitDraft = {
  name: 'Beber água',
  icon: 'cup-water',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-01-01',
  reminders: ['21:00'],
};

async function run(
  widgetName: string,
  click?: { habitId: string; date: string },
): Promise<{ light: string[]; dark: string[] }> {
  let drawn: { light: ReactNode; dark: ReactNode } | undefined;
  await widgetTaskHandler({
    widgetInfo: { widgetName, widgetId: 1, height: 250, width: 300, screenInfo: {} },
    widgetAction: click ? 'WIDGET_CLICK' : 'WIDGET_UPDATE',
    clickAction: click ? HABIT_ACTION : undefined,
    clickActionData: click,
    renderWidget: (widget: { light: ReactNode; dark: ReactNode }) => {
      mockOrder.push('draw');
      drawn = widget;
    },
  } as unknown as Parameters<typeof widgetTaskHandler>[0]);
  return { light: texts(drawn?.light), dark: texts(drawn?.dark) };
}

beforeEach(() => {
  mockRepos = createMemoryRepositories();
  mockOrder.length = 0;
  jest.mocked(rescheduleReminders).mockClear();
});

it('draws both widgets, light and dark, with an empty database (first use, signed out)', async () => {
  const today = await run(TODAY_WIDGET);
  expect(today.light).toEqual(['Hoje', 'Nenhum hábito para hoje']);
  expect(today.dark).toEqual(today.light);
  expect((await run(HEATMAP_WIDGET)).light).toContain('Últimas semanas');
});

it('checks a habit from the widget, redraws, then re-plans reminders', async () => {
  const habit = await mockRepos.habits.create(draft);
  const drawn = await run(TODAY_WIDGET, { habitId: habit.id, date: todayLocal() });
  expect(drawn.light).toEqual(['Hoje', '1/1', '✓', 'Beber água']);
  const [entry] = await mockRepos.entries.listByDate(todayLocal());
  expect(entry?.status).toBe('done');
  // The tap feels instant: the widget is redrawn before the reminders are re-planned.
  expect(mockOrder).toEqual(['draw', 'reminders']);
});

it('ignores taps on a widget left on screen since yesterday, or on a deleted habit', async () => {
  const habit = await mockRepos.habits.create(draft);
  await run(TODAY_WIDGET, { habitId: habit.id, date: addDaysLocal(todayLocal(), -1) });
  await run(TODAY_WIDGET, { habitId: 'deleted-habit', date: todayLocal() });
  expect(await mockRepos.entries.listByDate(todayLocal())).toEqual([]);
  expect(rescheduleReminders).not.toHaveBeenCalled();
  expect(mockOrder).toEqual(['draw', 'draw']);
});
