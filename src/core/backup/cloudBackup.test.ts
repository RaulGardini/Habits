import type { BackupRow, BackupTable } from './backup';
import {
  backupsToPrune,
  cloudSnapshot,
  countRows,
  isCloudBackupDue,
  restoreRows,
} from './cloudBackup';

const tables = (patch: Partial<Record<BackupTable, BackupRow[]>>) =>
  ({
    habits: [],
    habitEntries: [],
    habitReminders: [],
    tasks: [],
    events: [],
    dayNotes: [],
    goals: [],
    settings: [],
    ...patch,
  }) as Record<BackupTable, BackupRow[]>;

describe('isCloudBackupDue', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  it('is due without backups or after a week', () => {
    expect(isCloudBackupDue(null, now)).toBe(true);
    expect(isCloudBackupDue('2026-09-15T12:00:00.000Z', now)).toBe(true);
    expect(isCloudBackupDue('2026-09-16T12:00:00.000Z', now)).toBe(false);
  });
});

describe('backupsToPrune', () => {
  it('keeps the newest ones', () => {
    const list = ['01', '03', '02', '05', '04'].map((day) => ({
      id: day,
      createdAt: `2026-09-${day}T00:00:00.000Z`,
      rowCount: 1,
    }));
    expect(backupsToPrune(list, 3).sort()).toEqual(['01', '02']);
    expect(backupsToPrune(list, 8)).toEqual([]);
  });
});

describe('snapshot and restore', () => {
  const data = tables({
    habits: [{ id: 'h', updatedAt: '2026-09-01T00:00:00.000Z', deletedAt: null }],
    settings: [
      { key: 'theme', value: '"dark"', updatedAt: '2026-09-01T00:00:00.000Z' },
      { key: 'syncState', value: '{}', updatedAt: '2026-09-01T00:00:00.000Z' },
      { key: 'activeTimer', value: '{}', updatedAt: '2026-09-01T00:00:00.000Z' },
    ],
  });

  it('leaves device-only settings out of the snapshot', () => {
    const snapshot = cloudSnapshot(data, new Date('2026-09-22T00:00:00.000Z'));
    expect(snapshot.tables.settings.map((row) => row.key)).toEqual(['theme']);
    expect(countRows(snapshot.tables)).toBe(2);
  });

  it('stamps restored rows with the restore time so they win the merge', () => {
    const restored = restoreRows(data, '2026-09-22T10:00:00.000Z');
    expect(restored.habits[0]).toEqual({
      id: 'h',
      updatedAt: '2026-09-22T10:00:00.000Z',
      deletedAt: null,
    });
    expect(restored.settings.map((row) => row.key)).toEqual(['theme']);
  });
});
