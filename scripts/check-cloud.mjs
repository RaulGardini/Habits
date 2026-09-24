// Read-only look at what one account has in the cloud (Supabase), from outside the app: how many
// rows per table and when the account last changed there. Changes nothing.
//
//   PowerShell: $env:CHECK_EMAIL="…"; $env:CHECK_PASSWORD="…"; node --env-file=.env.local scripts/check-cloud.mjs
//   bash:       CHECK_EMAIL=… CHECK_PASSWORD=… node --env-file=.env.local scripts/check-cloud.mjs
//
// Prints counts and dates only, never the content of the rows.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.CHECK_EMAIL;
const password = process.env.CHECK_PASSWORD;
if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY');
if (!email || !password) throw new Error('Set CHECK_EMAIL and CHECK_PASSWORD');

const TABLES = [
  'habits',
  'habit_entries',
  'habit_reminders',
  'events',
  'goals',
  'tasks',
  'day_notes',
  'settings',
];

const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await signIn.json();
if (!session.access_token) {
  throw new Error(
    `Could not sign in: ${session.error_description ?? session.msg ?? signIn.status}`,
  );
}
const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
console.log(`Account ${session.user.id} (${session.user.email})\n`);

/** Row count of a filtered query (RLS already limits it to this account). */
async function count(query) {
  const response = await fetch(`${url}/rest/v1/${query}`, {
    method: 'HEAD',
    headers: { ...headers, Prefer: 'count=exact' },
  });
  if (!response.ok) return `error ${response.status}`;
  return Number(response.headers.get('content-range')?.split('/')[1] ?? NaN);
}

async function latest(table) {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=server_updated_at&order=server_updated_at.desc&limit=1`,
    { headers },
  );
  if (!response.ok) return `error ${response.status}`;
  const [row] = await response.json();
  return row?.server_updated_at ?? '—';
}

console.log('table            active  deleted  last change in the cloud');
for (const table of TABLES) {
  // settings has no id nor deleted_at (one row per key).
  const settings = table === 'settings';
  const active = await count(
    settings ? 'settings?select=key' : `${table}?select=id&deleted_at=is.null`,
  );
  const deleted = settings ? '—' : await count(`${table}?select=id&deleted_at=not.is.null`);
  console.log(
    `${table.padEnd(16)} ${String(active).padStart(6)}  ${String(deleted).padStart(7)}  ${await latest(table)}`,
  );
}
