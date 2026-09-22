// Web (and any platform without widgets): nothing to do.
// Android: sync.android.ts — iOS: sync.ios.ts.

/** Redraws the home screen widgets with the current data (debounced, fire and forget). */
export function updateWidgets(): void {}

/** Applies quick actions tapped in widgets while the app was closed. Returns true if any. */
export async function consumePendingWidgetActions(): Promise<boolean> {
  return false;
}
