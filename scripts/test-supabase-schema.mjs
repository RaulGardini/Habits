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

// Insert, then an older write is ignored and a newer one wins.
await as(A, upsert, ['Ler', '2026-09-10T10:00:00.000Z']);
await as(A, upsert, ['Velho', '2026-09-09T10:00:00.000Z']);
let rows = (await as(A, 'select name, server_updated_at from public.habits')).rows;
assert.equal(rows[0].name, 'Ler', 'older update must not overwrite');
const firstServerTime = rows[0].server_updated_at;
await as(A, upsert, ['Ler 20 páginas', '2026-09-11T10:00:00.000Z']);
rows = (await as(A, 'select name, server_updated_at from public.habits')).rows;
assert.equal(rows[0].name, 'Ler 20 páginas', 'newer update must win');
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

// Account deletion removes the user and cascades to every table.
await as(A, 'select public.delete_my_account()');
const left = await db.query(`select
  (select count(*) from public.habits where user_id = '${A}')::int as habits,
  (select count(*) from public.settings where user_id = '${A}')::int as settings,
  (select count(*) from auth.users where id = '${A}')::int as users,
  (select count(*) from public.habits where user_id = '${B}')::int as other`);
assert.deepEqual(left.rows[0], { habits: 0, settings: 0, users: 0, other: 1 });

console.log('supabase/schema.sql OK: LWW, RLS isolation and account deletion');
