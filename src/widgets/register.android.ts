import { isExpoGo } from '@/lib/runtime';

// Registers the headless task that renders Android widgets and handles their taps.
// Skipped in Expo Go, where the native widget module does not exist.
if (!isExpoGo) {
  const { registerWidgetTaskHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: crashes in Expo Go
    require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: crashes in Expo Go
    require('./android/taskHandler') as typeof import('./android/taskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
