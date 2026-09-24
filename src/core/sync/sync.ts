import { BACKUP_TABLES, type BackupRow, type BackupTable } from '@/core/backup/backup';
import { t } from '@/i18n/i18n';

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
export const LOCAL_ONLY_SETTINGS = new Set(['activeTimer', 'syncState', 'appLock']);

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
  /** Account these cursors belong to (another account on this device pushes everything). */
  userId?: string | null;
  /** Per table: highest `server_updated_at` already pulled. */
  cursors: Partial<Record<BackupTable, string>>;
}

export const INITIAL_SYNC_STATE: SyncState = { cursors: {} };

export interface RemoteApplyPlan<T> {
  toInsert: T[];
  /** Local rows to overwrite (the local identity is kept when matched by a natural key). */
  toUpdate: { existing: T; incoming: T }[];
  skipped: number;
}

/**
 * Conflict rule of the cloud sync: the server's order decides (last write to *reach the
 * server* wins, by `server_updated_at`), never the device clocks, which can be wrong.
 *
 * `incoming` are rows pulled for one table, in server order; for the same key the later one
 * wins. A local row with a change still waiting to be pushed (`isPending`) is kept: it goes up
 * on the next push and, arriving later, wins on every device. Rows identical to the local one
 * (e.g. our own push coming back) are skipped.
 */
export function planRemoteApply<T extends Record<string, unknown>>(
  existing: readonly T[],
  incoming: readonly T[],
  keyOf: (row: T) => string,
  isPending: (row: T) => boolean,
  identity: string,
): RemoteApplyPlan<T> {
  const local = new Map(existing.map((row) => [keyOf(row), row]));
  const latest = new Map<string, T>();
  for (const row of incoming) latest.set(keyOf(row), row);
  const plan: RemoteApplyPlan<T> = {
    toInsert: [],
    toUpdate: [],
    skipped: incoming.length - latest.size,
  };
  for (const [key, row] of latest) {
    const current = local.get(key);
    if (!current) plan.toInsert.push(row);
    else if (isPending(current) || sameContent(current, row, identity)) plan.skipped += 1;
    else plan.toUpdate.push({ existing: current, incoming: row });
  }
  return plan;
}

function sameContent(a: Record<string, unknown>, b: Record<string, unknown>, identity: string) {
  return Object.keys(b).every(
    (column) => column === identity || (a[column] ?? null) === (b[column] ?? null),
  );
}

/** Delay before the n-th retry (0-based) of a failed sync: exponential, capped, with jitter. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempt));
  // ±20% so many devices coming back online at once do not retry in lockstep.
  return Math.round(base * (0.8 + random() * 0.4));
}

/** Splits rows into chunks (PostgREST requests should stay small). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Friendly pt-BR message for Supabase auth/sync errors. */
export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return t('E-mail ou senha incorretos.');
  if (text.includes('email not confirmed')) return t('Confirme seu e-mail antes de entrar.');
  if (text.includes('already registered')) return t('Já existe uma conta com este e-mail.');
  if (text.includes('should be different'))
    return t('A nova senha precisa ser diferente da atual.');
  if (text.includes('password') && /weak|pwned|leaked|known|at least/.test(text)) {
    return t('Senha fraca. Use pelo menos 8 caracteres e evite senhas comuns.');
  }
  // Supabase: one e-mail per address every 60 s ("For security purposes, you can only request
  // this after 42 seconds.")…
  const seconds = /after (\d+) seconds?/.exec(text)?.[1];
  if (text.includes('security purposes')) {
    return seconds
      ? t('Aguarde {seconds} s para pedir outro e-mail.', { seconds })
      : t('Aguarde um minuto para pedir outro e-mail.');
  }
  // …and a cap on e-mails per hour for the whole project (2/hour with the built-in sender).
  if (text.includes('email rate limit')) {
    return t('O servidor atingiu o limite de e-mails por hora. Tente de novo mais tarde.');
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return t('Muitas tentativas. Aguarde alguns minutos.');
  }
  if (text.includes('jwt') || text.includes('refresh token')) {
    return t('Sua sessão expirou. Entre de novo para voltar a sincronizar.');
  }
  if (text.includes('network') || text.includes('fetch')) return t('Sem conexão com o servidor.');
  return t('Não foi possível concluir. Tente novamente.');
}
