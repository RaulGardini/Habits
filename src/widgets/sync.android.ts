import { isExpoGo } from '@/lib/runtime';
import { getRepositories } from '@/repositories';

import { loadWidgetSnapshot } from './data';

let timer: ReturnType<typeof setTimeout> | null = null;

/** Redraws the home screen widgets with the current data (debounced, fire and forget). */
export function updateWidgets(): void {
  // Widgets need a development build; the module would crash on import in Expo Go.
  if (isExpoGo) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    redraw().catch((error: unknown) => console.error('Widget update failed', error));
  }, 300);
}

async function redraw(): Promise<void> {
  // Loaded lazily for the same Expo Go reason.
  const { requestWidgetUpdate } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: crashes in Expo Go
    require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { HEATMAP_WIDGET, TODAY_WIDGET, renderWidget } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: crashes in Expo Go
    require('./android/widgets') as typeof import('./android/widgets');

  const snapshot = await loadWidgetSnapshot(getRepositories());
  for (const widgetName of [TODAY_WIDGET, HEATMAP_WIDGET]) {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (info) => renderWidget(widgetName, snapshot, info.height),
    });
  }
}

/** Android widgets write to the database directly: nothing is queued. */
export async function consumePendingWidgetActions(): Promise<boolean> {
  return false;
}
