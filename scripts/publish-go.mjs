// Publishes the iOS JS bundle for the owner's iPhone running Expo Go (channel `production`):
//   npm run publish:go
// Expo Go needs the SDK runtime version (see app.config.js), so this sets EXPO_GO_RUNTIME=1 for
// the EAS CLI — cross-platform, unlike `VAR=1 cmd` in an npm script on Windows.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  [
    'eas-cli@latest',
    'update',
    '--channel',
    'production',
    '--environment',
    'production',
    '--platform',
    'ios',
    '--non-interactive',
    '--message',
    process.argv[2] ?? 'Nova versão',
  ],
  { stdio: 'inherit', shell: true, env: { ...process.env, EXPO_GO_RUNTIME: '1' } },
);
process.exit(result.status ?? 1);
