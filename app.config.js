// app.json holds the configuration; this only picks the runtime version.
//
// Store builds (EAS Build) use the app version: an EAS Update only reaches builds with the same
// native code, and `version` must be bumped whenever native code changes. Expo Go only loads
// updates made for its SDK (`exposdk:57.0.0`), so `npm run publish:go` sets EXPO_GO_RUNTIME=1.
module.exports = ({ config }) => ({
  ...config,
  runtimeVersion:
    process.env.EXPO_GO_RUNTIME === '1' ? { policy: 'sdkVersion' } : { policy: 'appVersion' },
});
