-- Habits — cloud sync schema (Supabase / Postgres).
-- Run once in the Supabase SQL Editor (see docs/SUPABASE.md). Safe to re-run.
--
-- Mirrors the local SQLite tables (snake_case, timestamps as ISO-8601 text) plus:
--   user_id            owner (Row Level Security: each user only sees their rows)
--   server_updated_at  set by the server on every write; clients pull rows changed after
--                      their last cursor, so device clocks never decide what to download.
-- Conflicts are resolved last-write-wins by the client `updated_at` (see lww_guard).

create or replace function public.lww_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Keep the stored row when the incoming change is not newer.
    if new.updated_at <= old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

-- Helper to create one synced table with its policies, trigger and index.
create or replace function public.habits_setup_table(table_name text, columns text, pk text)
returns void language plpgsql as $$
begin
  execute format(
    'create table if not exists public.%I (
       user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
       %s,
       server_updated_at timestamptz not null default clock_timestamp(),
       primary key (%s)
     )', table_name, columns, pk);
  execute format('alter table public.%I enable row level security', table_name);
  execute format('drop policy if exists "own rows" on public.%I', table_name);
  execute format(
    'create policy "own rows" on public.%I for all to authenticated
       using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
    table_name);
  execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  execute format('drop trigger if exists lww_guard on public.%I', table_name);
  execute format(
    'create trigger lww_guard before insert or update on public.%I
       for each row execute function public.lww_guard()', table_name);
  execute format(
    'create index if not exists %I on public.%I (user_id, server_updated_at)',
    table_name || '_sync_idx', table_name);
end $$;

select public.habits_setup_table('habits', '
  id text not null,
  name text not null,
  icon text not null,
  color text not null,
  time_of_day text not null,
  frequency_type text not null,
  frequency_weekdays integer,
  frequency_count integer,
  frequency_period text,
  frequency_interval integer,
  tracking_type text not null,
  target_value double precision,
  unit text,
  quantity_step double precision,
  start_date text not null,
  archived_at text,
  sort_order integer not null default 0,
  goal_id text,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('habit_entries', '
  id text not null,
  habit_id text not null,
  date text not null,
  status text not null,
  value double precision,
  note text,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('habit_reminders', '
  id text not null,
  habit_id text not null,
  time text not null,
  weekdays integer,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('tasks', '
  id text not null,
  title text not null,
  date text not null,
  priority text not null,
  completed_at text,
  rolled_from text,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('events', '
  id text not null,
  title text not null,
  date text not null,
  start_time text not null,
  end_time text,
  color text not null,
  note text,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

-- Added after the first release: agenda details (idempotent).
alter table public.events add column if not exists all_day integer not null default 0;
alter table public.events add column if not exists location text;
alter table public.events add column if not exists repeat text not null default 'none';
alter table public.events add column if not exists repeat_until text;
alter table public.events add column if not exists excluded_dates text not null default '';
alter table public.events add column if not exists reminder_minutes integer;

select public.habits_setup_table('day_notes', '
  id text not null,
  date text not null,
  content text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('goals', '
  id text not null,
  title text not null,
  scope text not null,
  period text not null,
  target double precision not null,
  unit text,
  current double precision not null default 0,
  habit_id text,
  created_at text not null,
  updated_at text not null,
  deleted_at text', 'user_id, id');

select public.habits_setup_table('settings', '
  key text not null,
  value text not null,
  updated_at text not null', 'user_id, key');

drop function public.habits_setup_table(text, text, text);

-- In-app account deletion (required by the App Store): removes the auth user; every synced
-- row goes with it through `on delete cascade`.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = (select auth.uid());
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
