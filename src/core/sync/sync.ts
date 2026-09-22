import { BACKUP_TABLES, type BackupRow, type BackupTable } from '@/core/backup/backup';

/**
 * Cloud sync (optional). Local rows use camelCase columns; the Postgres mirror uses
 * snake_case plus `user_id` and `server_updated_at` (see supabase/schema.sql).
 */

/** Remote table name for each local table. */
export const REMOTE_TABLES: Record<BackupTable, string> = {
  habits: 'habits',
  habitEntries: 'habit_entries',
  habitReminders: 'habit_reminders',
  tasks: 'tasks',
  events: 'events',
  dayNotes: 'day_notes',
  goals: 'goals',
  settings: 'settings',
};

/** Parents before children, so foreign keys are satisfied when applying pulled rows. */
export const SYNC_ORDER: readonly BackupTable[] = BACKUP_TABLES;

/** Settings that describe this device only and must never leave it. */
export const LOCAL_ONLY_SETTINGS = new Set(['activeTimer', 'syncState']);

/** Columns added by the server; never written by clients nor stored locally. */
const SERVER_COLUMNS = new Set(['user_id', 'server_updated_at']);

export function toSnakeCase(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** Local row → remote row. */
export function toRemoteRow(row: BackupRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toSnakeCase(key), value]));
}

/** Remote row → local row (server-only columns dropped). */
export function toLocalRow(row: Record<string, unknown>): BackupRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !SERVER_COLUMNS.has(key))
      .map(([key, value]) => [toCamelCase(key), value]),
  ) as BackupRow;
}

/** Rows of a table that should be pushed (local-only settings are filtered out). */
export function pushableRows(table: BackupTable, rows: readonly BackupRow[]): BackupRow[] {
  if (table !== 'settings') return [...rows];
  return rows.filter((row) => !LOCAL_ONLY_SETTINGS.has(String(row.key)));
}

export interface SyncState {
  /** Local instant when the last successful push started (rows updated after it are pushed). */
  lastPushedAt: string | null;
  /** Per table: highest `server_updated_at` already pulled. */
  cursors: Partial<Record<BackupTable, string>>;
}

export const INITIAL_SYNC_STATE: SyncState = { lastPushedAt: null, cursors: {} };

/** Splits rows into chunks (PostgREST requests should stay small). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Friendly pt-BR message for Supabase auth errors. */
export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (text.includes('already registered')) return 'Já existe uma conta com este e-mail.';
  if (text.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 6 caracteres.';
  if (text.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (text.includes('network') || text.includes('fetch')) return 'Sem conexão com o servidor.';
  return 'Não foi possível concluir. Tente novamente.';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Informe um e-mail válido.';
  if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  return null;
}
