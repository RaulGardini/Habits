#!/usr/bin/env bash
# Disaster drill for the database backup, 100% local (Docker + Supabase CLI, no real data):
# a local Supabase gets our schema and two users with data, is backed up with the SAME commands
# as .github/workflows/db-backup.yml (dump + encryption), wiped, restored with
# scripts/db-restore.sh, and checked: rows, owners, RLS and triggers must all come back.
#
#   (in an empty folder)  npx supabase init   (give it its own project_id/ports if other local
#   Supabase projects run)  and  npx supabase start -x realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
#   DRILL_PROJECT_DIR=<that folder> scripts/db-backup-drill.sh
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
project="${DRILL_PROJECT_DIR:?set DRILL_PROJECT_DIR to the folder where the local Supabase runs}"
config="$project/supabase/config.toml"
# Only ever touch THIS local project (other local Supabase projects may be running): its
# container is found by exact name and its database by its own port.
project_id="$(grep -m1 "^project_id" "$config" | cut -d\" -f2)"
[ -n "$project_id" ] || { echo "No project_id in $config"; exit 1; }
port="$(awk '/^\[db\]/{db=1; next} /^\[/{db=0} db && /^port =/{print $3; exit}' "$config")"
container="supabase_db_${project_id}"
docker ps --format '{{.Names}}' | grep -qx "$container" ||
  { echo "Container $container is not running (npx supabase start in $project)"; exit 1; }
db_url="postgresql://postgres:postgres@127.0.0.1:${port}/postgres"
# Seen from inside a container (psql of the restore script).
container_db_url="postgresql://postgres:postgres@host.docker.internal:${port}/postgres"
echo "Drill on $container (port $port)"
sql() { docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
A=00000000-0000-0000-0000-0000000000aa
B=00000000-0000-0000-0000-0000000000bb

echo '1) Schema + two users with data'
sql <"$repo/supabase/schema.sql" >/dev/null
sql <<SQL
insert into auth.users (id, aud, role, email) values
  ('$A', 'authenticated', 'authenticated', 'a@drill.test'),
  ('$B', 'authenticated', 'authenticated', 'b@drill.test');
insert into public.habits (user_id, id, name, icon, color, time_of_day, frequency_type,
  tracking_type, start_date, created_at, updated_at)
select u, 'h-' || u || '-' || n, 'Hábito ' || n, 'star', 'blue', 'anytime', 'daily', 'boolean',
  '2026-01-01', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
from (values ('$A'::uuid), ('$B'::uuid)) as users(u), generate_series(1, 5) as n;
insert into public.habit_entries (user_id, id, habit_id, date, status, created_at, updated_at)
select h.user_id, 'e-' || h.id || '-' || d, h.id, to_char(date '2026-01-01' + d, 'YYYY-MM-DD'), 'done',
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
from public.habits h, generate_series(0, 99) as d;
insert into public.settings (user_id, key, value, updated_at) values
  ('$A', 'theme', '"dark"', '2026-01-01T00:00:00Z');
insert into public.cloud_backups (user_id, row_count, content) values ('$A', 1, '{"tables":{}}');
SQL
counts="select (select count(*) from auth.users) || ' ' || (select count(*) from public.habits) || ' ' ||
  (select count(*) from public.habit_entries) || ' ' || (select count(*) from public.settings) || ' ' ||
  (select count(*) from public.cloud_backups) || ' ' ||
  (select count(*) from public.habit_entries where user_id = '$A')"
before="$(sql -c "$counts")"
echo "   users habits entries settings backups entries_of_A = $before"

echo '2) Backup (same commands as the workflow)'
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/backup"
(cd "$project" &&
  npx -y supabase@latest db dump --db-url "$db_url" -f "$work/backup/roles.sql" --role-only &&
  npx -y supabase@latest db dump --db-url "$db_url" -f "$work/backup/schema.sql" &&
  npx -y supabase@latest db dump --db-url "$db_url" -f "$work/backup/data.sql" --use-copy --data-only --schema public,auth)
export BACKUP_PASSPHRASE="drill-$(date +%s)-passphrase"
(cd "$work" && tar -czf - backup | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -pass env:BACKUP_PASSPHRASE -out habits-db-drill.tar.gz.enc)
grep -q "Hábito" "$work/habits-db-drill.tar.gz.enc" && { echo 'Backup is not encrypted!'; exit 1; }
ls -l "$work/habits-db-drill.tar.gz.enc"

echo '3) Disaster: the database is wiped'
(cd "$project" && npx -y supabase@latest db reset >/dev/null 2>&1)
sql -c "select to_regclass('public.habits') is null" | grep -q t && echo '   public.habits is gone'

echo '4) Restore'
TARGET_DB_URL="$container_db_url" "$repo/scripts/db-restore.sh" "$work/habits-db-drill.tar.gz.enc" >/dev/null

echo '5) Checks'
after="$(sql -c "$counts")"
echo "   users habits entries settings backups entries_of_A = $after"
[ "$before" = "$after" ] || { echo 'FAIL: counts differ'; exit 1; }
rls="$(sql -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity")"
[ "$rls" = 0 ] || { echo "FAIL: $rls public table(s) without RLS after restore"; exit 1; }
policies="$(sql -c "select count(*) from pg_policies where schemaname = 'public'")"
triggers="$(sql -c "select count(*) from pg_trigger where tgname = 'lww_guard'")"
echo "   RLS on every table, $policies policies, $triggers lww_guard triggers"
[ "$policies" -ge 9 ] && [ "$triggers" -ge 8 ] || { echo 'FAIL: policies/triggers missing'; exit 1; }
# Row isolation still works with the restored data: B sees only B's rows.
seen="$(sql -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$B\",\"role\":\"authenticated\"}', true); select count(*) from public.habits;" | tail -1)"
[ "$seen" = 5 ] || { echo "FAIL: user B sees $seen habits instead of 5"; exit 1; }
echo '   user B sees only their own 5 habits'
echo 'Drill passed: the backup restores completely.'
