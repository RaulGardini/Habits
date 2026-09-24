import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { todayLocal } from '@/core/dates/localDate';
import { initRepositories } from '@/db/init';
import { logError } from '@/lib/log';
import { useEntriesStore } from '@/stores/entriesStore';
import { rescheduleReminders } from '@/stores/reminders';

import { applyWidgetAction, loadWidgetSnapshot } from '../data';
import { HABIT_ACTION, renderWidget } from './widgets';

export async function widgetTaskHandler({
  widgetInfo,
  widgetAction,
  clickAction,
  clickActionData,
  renderWidget: draw,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  // Runs as a headless JS task: when the app is closed nothing is initialized yet.
  const repos = await initRepositories();

  let changed = false;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === HABIT_ACTION) {
    const habitId = String(clickActionData?.habitId ?? '');
    const date = String(clickActionData?.date ?? todayLocal());
    // A widget left on screen overnight still shows yesterday: only record for today.
    if (date === todayLocal() && (await applyWidgetAction(repos, habitId, date))) {
      // If the app is running, drop its cached entries so screens reload from the database.
      useEntriesStore.getState().reset();
      changed = true;
    }
  }

  const snapshot = await loadWidgetSnapshot(repos);
  draw(renderWidget(widgetInfo.widgetName, snapshot, widgetInfo.height));

  // After the redraw (the tap feels instant): a habit checked from the widget stops reminding
  // today, even with the app closed.
  if (changed) {
    await rescheduleReminders().catch((error: unknown) =>
      logError('Widget reminder sync failed', error),
    );
  }
}
