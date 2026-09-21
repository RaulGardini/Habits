import * as Haptics from 'expo-haptics';

/** Feedback when a habit is completed. Fire-and-forget; failures are irrelevant. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
