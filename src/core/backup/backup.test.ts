import {
  BACKUP_TABLES,
  BackupError,
  backupFileName,
  createBackup,
  mergeKey,
  parseBackup,
  planMerge,
  type BackupRow,
  type BackupTable,
} from './backup';

const emptyTables = () =>
  Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as Record<
    BackupTable,
    BackupRow[]
  >;

const habitRow = (patch: Partial<BackupRow> = {}): BackupRow => ({
  id: 'h1',
  name: 'Ler',
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequencyType: 'daily',
  trackingType: 'boolean',
  startDate: '2026-09-01',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...patch,
});

describe('createBackup / parseBackup', () => {
  it('round-trips a backup', () => {
    const tables = emptyTables();
    tables.habits = [habitRow()];
    const json = JSON.stringify(createBackup(tables, new Date('2026-09-21T12:00:00Z')));
    const parsed = parseBackup(json);
    expect(parsed.tables.habits).toHaveLength(1);
    expect(parsed.exportedAt).toBe('2026-09-21T12:00:00.000Z');
  });

  it('treats missing tables as empty (older backups)', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'habits', version: 1, tables: {} }));
    expect(parsed.tables.goals).toEqual([]);
  });

  it.each([
    ['not json', 'O arquivo não é um JSON válido.'],
    [
      JSON.stringify({ app: 'other', version: 1, tables: {} }),
      'Este arquivo não é um backup deste app.',
    ],
    [JSON.stringify({ app: 'habits', version: 99, tables: {} }), 'versão mais nova'],
    [JSON.stringify({ app: 'habits', version: 1 }), 'dados ausentes'],
    [JSON.stringify({ app: 'habits', version: 1, tables: { habits: 'x' } }), '"habits"'],
  ])('rejects %s', (json, message) => {
    expect(() => parseBackup(json)).toThrow(BackupError);
    expect(() => parseBackup(json)).toThrow(message);
  });

  it.each([
    ['habits', habitRow({ timeOfDay: 'midnight' }), 'timeOfDay'],
    ['habits', habitRow({ startDate: '01/09/2026' }), 'startDate'],
    ['habits', habitRow({ targetValue: 'muito' }), 'targetValue'],
    ['habits', habitRow({ updatedAt: 'ontem' }), 'updatedAt'],
    [
      'habitEntries',
      {
        id: 'e',
        habitId: 'h1',
        date: '2026-09-01',
        status: 'hacked',
        createdAt: 'x',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      'status',
    ],
    [
      'habitReminders',
      { id: 'r', habitId: 'h1', time: '25:00', createdAt: 'x', updatedAt: '2026-09-01T00:00:00Z' },
      'time',
    ],
    ['settings', { key: 'theme', value: '{not json', updatedAt: '2026-09-01T00:00:00Z' }, 'value'],
  ])('rejects invalid values in %s (%s)', (table, row, column) => {
    const json = JSON.stringify({ app: 'habits', version: 1, tables: { [table]: [row] } });
    expect(() => parseBackup(json)).toThrow(`"${column}" inválido`);
  });

  it.each([0, -1, 1.5, '1'])('rejects version %p', (version) => {
    expect(() => parseBackup(JSON.stringify({ app: 'habits', version, tables: {} }))).toThrow(
      BackupError,
    );
  });

  it('accepts optional columns left empty', () => {
    const json = JSON.stringify({
      app: 'habits',
      version: 1,
      tables: { habits: [habitRow({ frequencyPeriod: null, targetValue: null, deletedAt: null })] },
    });
    expect(parseBackup(json).tables.habits).toHaveLength(1);
  });

  it('rejects rows without required columns', () => {
    const json = JSON.stringify({
      app: 'habits',
      version: 1,
      tables: { habits: [habitRow({ name: undefined })] },
    });
    expect(() => parseBackup(json)).toThrow('sem "name"');
  });
});

describe('planMerge (last write wins)', () => {
  const key = (row: BackupRow) => String(row.id);

  it('inserts new rows, updates newer ones and skips older ones', () => {
    const existing = [
      habitRow({ id: 'a', updatedAt: '2026-09-10T00:00:00Z' }),
      habitRow({ id: 'b', updatedAt: '2026-09-10T00:00:00Z' }),
    ];
    const incoming = [
      habitRow({ id: 'a', name: 'Novo', updatedAt: '2026-09-11T00:00:00Z' }),
      habitRow({ id: 'b', name: 'Velho', updatedAt: '2026-09-09T00:00:00Z' }),
      habitRow({ id: 'c' }),
    ];
    const plan = planMerge(existing, incoming, key);
    expect(plan.toInsert.map((r) => r.id)).toEqual(['c']);
    expect(plan.toUpdate.map((u) => u.incoming.name)).toEqual(['Novo']);
    expect(plan.skipped).toBe(1);
  });

  it('skips equal timestamps and duplicated incoming rows', () => {
    const row = habitRow();
    const plan = planMerge([row], [row, habitRow({ id: 'x' }), habitRow({ id: 'x' })], key);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.skipped).toBe(2);
  });

  it('matches entries by habit and day even with different ids', () => {
    const keyOf = mergeKey('habitEntries');
    const local = {
      id: 'local',
      habitId: 'h',
      date: '2026-09-21',
      updatedAt: '2026-09-21T08:00:00Z',
    };
    const remote = {
      id: 'remote',
      habitId: 'h',
      date: '2026-09-21',
      updatedAt: '2026-09-21T09:00:00Z',
    };
    const plan = planMerge([local], [remote], keyOf);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate[0]?.existing.id).toBe('local');
  });
});

describe('backupFileName', () => {
  it('includes the date', () => {
    expect(backupFileName('2026-09-21')).toBe('backup-habits-2026-09-21.json');
  });
});
