import { ExtensionStorage } from '@bacons/apple-targets';

import { getRepositories } from '@/repositories';

import { applyWidgetAction, loadWidgetSnapshot } from './data';
import {
  APP_GROUP,
  PENDING_ACTIONS_KEY,
  SNAPSHOT_KEY,
  parsePendingActions,
  toIosPayload,
} from './iosPayload';
import { logError } from '@/lib/log';

// In Expo Go the native module is missing and ExtensionStorage silently does nothing.
const storage = new ExtensionStorage(APP_GROUP);
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes the snapshot to the App Group and reloads the WidgetKit timelines (debounced). */
export function updateWidgets(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    loadWidgetSnapshot(getRepositories())
      .then((snapshot) => {
        storage.set(SNAPSHOT_KEY, JSON.stringify(toIosPayload(snapshot)));
        ExtensionStorage.reloadWidget();
      })
      .catch((error: unknown) => logError('Widget update failed', error));
  }, 300);
}

/**
 * The iOS widget cannot open the app's database: its quick-check buttons append to a queue in
 * the App Group, applied here when the app starts or returns to the foreground.
 */
export async function consumePendingWidgetActions(): Promise<boolean> {
  const actions = parsePendingActions(storage.get(PENDING_ACTIONS_KEY));
  if (actions.length === 0) return false;
  storage.remove(PENDING_ACTIONS_KEY);
  const repos = getRepositories();
  for (const action of actions) await applyWidgetAction(repos, action.habitId, action.date);
  return true;
}
