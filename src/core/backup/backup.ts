import { t } from '@/i18n/i18n';
/**
 * JSON backup format. Rows are exported exactly as stored (camelCase columns), including
 * soft-deleted rows, so a restore is faithful and merging stays sync-friendly.
 */
export const BACKUP_APP = 'habits';
export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = [
  'habits',
  'habitEntries',
  'habitReminders',
  'tasks',
  'events',
  'dayNotes',
  'goals',
  'settings',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, unknown> & { updatedAt: string };

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, BackupRow[]>;
}

/** Required string columns per table (besides `updatedAt`), used to reject broken files. */
const REQUIRED_STRINGS: Record<BackupTable, readonly string[]> = {
  habits: [
    'id',
    'name',
    'icon',
    'color',
    'timeOfDay',
    'frequencyType',
    'trackingType',
    'startDate',
    'createdAt',
  ],
  habitEntries: ['id', 'habitId', 'date', 'status', 'createdAt'],
  habitReminders: ['id', 'habitId', 'time', 'createdAt'],
  tasks: ['id', 'title', 'date', 'priority', 'createdAt'],
  events: ['id', 'title', 'date', 'startTime', 'color', 'createdAt'],
  dayNotes: ['id', 'date', 'content', 'createdAt'],
  goals: ['id', 'title', 'scope', 'period', 'createdAt'],
  settings: ['key', 'value'],
};

export class BackupError extends Error {}

export function createBackup(tables: Record<BackupTable, BackupRow[]>, now: Date): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), tables };
}

/** Parses and validates a backup file. Throws `BackupError` with a pt-BR message. */
export function parseBackup(json: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupError(t('O arquivo não é um JSON válido.'));
  }
  if (typeof data !== 'object' || data === null)
    throw new BackupError(t('Arquivo de backup inválido.'));
  const file = data as Partial<BackupFile>;
  if (file.app !== BACKUP_APP) throw new BackupError(t('Este arquivo não é um backup deste app.'));
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new BackupError(
      t('Este backup foi feito por uma versão mais nova do app. Atualize o app.'),
    );
  }
  if (typeof file.tables !== 'object' || file.tables === null) {
    throw new BackupError(t('Arquivo de backup inválido: dados ausentes.'));
  }

  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    const rows = (file.tables as Record<string, unknown>)[table] ?? [];
    if (!Array.isArray(rows))
      throw new BackupError(t('Arquivo de backup inválido: "{table}".', { table }));
    rows.forEach((row: unknown, index) => {
      const record = row as Record<string, unknown>;
      const missing = [...REQUIRED_STRINGS[table], 'updatedAt'].find(
        (column) => typeof record?.[column] !== 'string',
      );
      if (missing) {
        throw new BackupError(
          t('Arquivo de backup inválido: "{table}" #{index} sem "{missing}".', {
            table,
            index: index + 1,
            missing,
          }),
        );
      }
    });
    tables[table] = rows as BackupRow[];
  }
  return {
    app: BACKUP_APP,
    version: file.version,
    exportedAt: String(file.exportedAt ?? ''),
    tables,
  };
}

export interface MergePlan<T> {
  /** Rows not present locally. */
  toInsert: T[];
  /** Local rows to overwrite with newer incoming data (keeps the local row's identity). */
  toUpdate: { existing: T; incoming: T }[];
  /** Incoming rows that are older or equal to the local ones. */
  skipped: number;
}

/**
 * Last-write-wins merge by `updatedAt`. Rows are matched by `keyOf` — the id, or a natural key
 * for tables with a unique constraint (one entry per habit per day, one note per day).
 */
export function planMerge<T extends { updatedAt: string }>(
  existing: readonly T[],
  incoming: readonly T[],
  keyOf: (row: T) => string,
): MergePlan<T> {
  const local = new Map(existing.map((row) => [keyOf(row), row]));
  const plan: MergePlan<T> = { toInsert: [], toUpdate: [], skipped: 0 };
  const seen = new Set<string>();
  for (const row of incoming) {
    const key = keyOf(row);
    if (seen.has(key)) {
      plan.skipped += 1;
      continue;
    }
    seen.add(key);
    const current = local.get(key);
    if (!current) plan.toInsert.push(row);
    else if (row.updatedAt > current.updatedAt)
      plan.toUpdate.push({ existing: current, incoming: row });
    else plan.skipped += 1;
  }
  return plan;
}

/** Matching key per table (natural keys where the schema has a unique constraint). */
export function mergeKey(table: BackupTable): (row: BackupRow) => string {
  switch (table) {
    case 'habitEntries':
      return (row) => `${String(row.habitId)}|${String(row.date)}`;
    case 'dayNotes':
      return (row) => String(row.date);
    case 'settings':
      return (row) => String(row.key);
    default:
      return (row) => String(row.id);
  }
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
}

/** "backup-habits-2026-09-21.json" */
export function backupFileName(date: string): string {
  return `backup-habits-${date}.json`;
}
