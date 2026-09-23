// Runs the date tests once per device time zone (Jest cannot switch zones inside a run).
// Usage: npm run test:tz
import { spawnSync } from 'node:child_process';

const ZONES = [
  'UTC',
  'America/Sao_Paulo', // DST until 2019, switching at midnight
  'America/New_York', // DST at 02:00
  'Asia/Tokyo',
  'Asia/Kolkata', // +05:30
  'Pacific/Kiritimati', // +14
  'Pacific/Pago_Pago', // −11
];

let failed = false;
for (const zone of ZONES) {
  const result = spawnSync(
    'npx',
    ['jest', 'src/core/dates/timezones.test.ts', 'src/core/habits', 'src/core/stats', '--silent'],
    { env: { ...process.env, TZ: zone }, stdio: ['ignore', 'ignore', 'pipe'], shell: true },
  );
  const summary = String(result.stderr).match(/Tests:.*$/m)?.[0] ?? '';
  console.log(`${result.status === 0 ? 'ok  ' : 'FAIL'} ${zone.padEnd(20)} ${summary}`);
  if (result.status !== 0) {
    failed = true;
    console.error(String(result.stderr));
  }
}
process.exit(failed ? 1 : 0);
