#!/usr/bin/env bash
# Restores a backup made by .github/workflows/db-backup.yml into an EMPTY Supabase project
# (a new project, or the local one from `npx supabase start`). Needs Docker (runs psql in a
# container, so nothing else has to be installed).
#
#   BACKUP_PASSPHRASE=… TARGET_DB_URL='postgresql://…' scripts/db-restore.sh habits-db-2026-09-28.tar.gz.enc
#
# TARGET_DB_URL: Supabase → Connect → Session pooler URI of the TARGET project. Never restore
# over the production database: the restore expects empty tables.
# Steps from https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
set -euo pipefail

file="${1:?usage: scripts/db-restore.sh <backup.tar.gz.enc>}"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
: "${TARGET_DB_URL:?set TARGET_DB_URL}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$file" |
  tar -xzf - -C "$work"
ls -l "$work/backup"

# Git Bash on Windows rewrites /paths in arguments and Docker needs a Windows path to mount.
host_dir="$(cygpath -w "$work/backup" 2>/dev/null || echo "$work/backup")"
psql() {
  MSYS_NO_PATHCONV=1 docker run --rm -v "$host_dir:/backup:ro" postgres:17 psql "$@" --dbname "$TARGET_DB_URL"
}

# roles.sql only tunes Supabase's built-in roles (timeouts, internal grants): the target project
# already has them, and some lines are refused there — apply it best-effort.
psql --quiet --file /backup/roles.sql || echo 'Some role settings were skipped (not needed).'
# Schema and data: all or nothing.
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file /backup/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file /backup/data.sql

echo "Restored. Check the row counts in the target project (SQL editor):"
echo "  select count(*) from auth.users; select count(*) from public.habits;"
