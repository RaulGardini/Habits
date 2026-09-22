import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback. Fire-and-forget: failures (and the web, where there is none) are irrelevant.
 * Keep it meaningful — a tap that changes something, not every touch.
 */

/** A habit was completed, something was saved, a goal was reached. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A value changed: +/- buttons, timer start/stop, undoing. */
export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Picking one option among others: segmented controls, chips, changing day or period. */
export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** A destructive confirmation is being asked. */
export function hapticWarning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Something went wrong (error dialogs). */
export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
