/** iOS home screen widgets (WidgetKit). See CLAUDE.md → "Widgets". */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'HabitsWidget',
  displayName: 'Hábitos',
  // Interactive widgets (Button with AppIntent) need iOS 17.
  deploymentTarget: '17.0',
  colors: {
    $widgetBackground: { light: '#ffffff', dark: '#1a1a1f' },
    $accent: { light: '#4f46e5', dark: '#a5b4fc' },
  },
  // Same App Group as the app: the app writes the snapshot, the widget reads it.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
