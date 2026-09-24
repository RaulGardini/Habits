// Runs supabase/schema.sql on a real Postgres (PGlite, WebAssembly) with a stub of the parts of
// Supabase it relies on (auth schema, auth.uid(), `authenticated` role), then checks the rules
// the sync depends on: last-write-wins, row isolation between users and account deletion.
//
//   npm run test:sql
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  grant usage on schema public, auth to authenticated;
  -- Like Supabase: anonymous requests can use the schema and get every new table by default.
  grant usage on schema public to anon;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`);
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
// Re-running must be safe.
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));

async function as(user, sql, params) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

const upsert = `
  insert into public.habits (id, name, icon, color, time_of_day, frequency_type, tracking_type,
    start_date, created_at, updated_at)
  values ('h1', $1, 'star', 'blue', 'anytime', 'daily', 'boolean', '2026-09-01',
    '2026-09-01T00:00:00.000Z', $2)
  on conflict (user_id, id) do update set name = excluded.name, updated_at = excluded.updated_at`;

// Last write to reach the server wins, whatever the client clocks say.
await as(A, upsert, ['Ler', '2030-01-01T00:00:00.000Z']); // device clock years ahead
let rows = (await as(A, 'select name, server_updated_at from public.habits')).rows;
const firstServerTime = rows[0].server_updated_at;
await as(A, upsert, ['Ler 20 páginas', '2026-09-11T10:00:00.000Z']);
rows = (await as(A, 'select name, server_updated_at from public.habits')).rows;
assert.equal(rows[0].name, 'Ler 20 páginas', 'the later write must win, not the later clock');
assert.ok(rows[0].server_updated_at > firstServerTime, 'server_updated_at must advance');

// Isolation: user B does not see A's rows and has an independent row with the same id.
assert.equal((await as(B, 'select * from public.habits')).rows.length, 0, 'B must not see A');
await as(B, upsert, ['Correr', '2026-09-01T00:00:00.000Z']);
assert.equal((await as(A, 'select * from public.habits')).rows.length, 1, 'A still has one row');

// A user cannot write rows for someone else.
await assert.rejects(
  as(
    A,
    `insert into public.settings (user_id, key, value, updated_at)
         values ('${B}', 'theme', '"dark"', '2026-09-01T00:00:00.000Z')`,
  ),
  /row-level security/,
);

// Settings use (user_id, key).
await as(
  A,
  `insert into public.settings (key, value, updated_at)
             values ('theme', '"dark"', '2026-09-01T00:00:00.000Z')`,
);

// Cloud backups are private to their owner and go away with the account.
await as(A, `insert into public.cloud_backups (row_count, content) values (2, '{"tables":{}}')`);
assert.equal(
  (await as(B, 'select * from public.cloud_backups')).rows.length,
  0,
  'B must not see A backups',
);
assert.equal((await as(A, 'select * from public.cloud_backups')).rows.length, 1);

// Every table of the public schema has Row Level Security, and anonymous requests have no
// privileges at all (the app only talks to the tables when signed in).
const unprotected = await db.query(`select relname from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
assert.deepEqual(unprotected.rows, [], 'every public table must have RLS');
await db.exec('set role anon;');
await assert.rejects(db.query('select * from public.habits'), /permission denied/);
await assert.rejects(db.query('select * from public.cloud_backups'), /permission denied/);
await db.exec('reset role;');

// An owner cannot be changed: the row stays with A even if A tries to give it to B.
await as(A, `update public.settings set user_id = '${B}' where key = 'theme'`);
assert.equal(
  (await as(A, `select count(*)::int as n from public.settings where key = 'theme'`)).rows[0].n,
  1,
  'the row must stay with its owner',
);

// Account deletion removes the user and cascades to every table.
await as(A, 'select public.delete_my_account()');
const left = await db.query(`select
  (select count(*) from public.habits where user_id = '${A}')::int as habits,
  (select count(*) from public.settings where user_id = '${A}')::int as settings,
  (select count(*) from public.cloud_backups where user_id = '${A}')::int as backups,
  (select count(*) from auth.users where id = '${A}')::int as users,
  (select count(*) from public.habits where user_id = '${B}')::int as other`);
assert.deepEqual(left.rows[0], { habits: 0, settings: 0, backups: 0, users: 0, other: 1 });

// Many users: every query the sync makes must use an index for the signed-in user's rows, never
// scan the whole table (it grows with every account). 300 users × 300 entries.
const USERS = 300;
const PER_USER = 300;
await db.exec(`
  insert into auth.users
    select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
    from generate_series(1000, 999 + ${USERS}) as n;
  insert into public.habit_entries (user_id, id, habit_id, date, status, created_at, updated_at)
    select u.id, 'e' || i, 'h' || (i % 8), '2026-01-01', 'done', '2026-01-01', '2026-01-01'
    from auth.users u, generate_series(1, ${PER_USER}) as i
    where u.id not in ('${A}', '${B}');
  analyze public.habit_entries;
`);
const someone = `00000000-0000-0000-0000-${(1150).toString(16).padStart(12, '0')}`;
const syncQueries = {
  // RemoteStore.pull: changes after the cursor, oldest first.
  pull: `select * from public.habit_entries where server_updated_at > '2000-01-01'
         order by server_updated_at limit 500`,
  // RemoteStore.keys: every id, page by page.
  keys: 'select id from public.habit_entries order by id limit 1000 offset 0',
  // RemoteStore.hasData: does the account have anything?
  hasData: 'select id from public.habit_entries where deleted_at is null limit 1',
};
for (const [name, sql] of Object.entries(syncQueries)) {
  const plan = (await as(someone, `explain ${sql}`)).rows.map((row) => row['QUERY PLAN']);
  assert.ok(
    !plan.some((line) => /Seq Scan on habit_entries/.test(line)),
    `${name} scans the whole table:\n${plan.join('\n')}`,
  );
  const rows = (await as(someone, sql)).rows;
  assert.ok(rows.length > 0 && rows.length <= PER_USER, `${name} returned ${rows.length} rows`);
}

console.log(
  `supabase/schema.sql OK: server-time LWW, RLS isolation, cloud backups, account deletion; ` +
    `sync queries use indexes with ${USERS * PER_USER} rows`,
);
