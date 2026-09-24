import { INITIAL_SYNC_STATE, type SyncState } from '@/core/sync/sync';
import type { HabitDraft } from '@/core/habits/types';
import { openTestDatabase, wrapSqlJs } from '@/db/testing';
import { createDrizzleRepositories } from '@/repositories/drizzle';

import { queueMissing, runSync, type RemoteStore } from './engine';
import { createFakeRemote } from './testing';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

const draft = (patch: Partial<HabitDraft> = {}): HabitDraft => ({
  name: 'Ler',
  icon: 'book',
  color: 'blue',
  timeOfDay: 'anytime',
  frequency: { type: 'daily' },
  tracking: { type: 'boolean' },
  startDate: '2026-09-01',
  reminders: ['08:00'],
  ...patch,
});

/** A device = its own local database + its own sync state. */
async function device() {
  const { sqlite } = await openTestDatabase();
  let repos = createDrizzleRepositories(wrapSqlJs(sqlite).db);
  let state: SyncState = INITIAL_SYNC_STATE;
  return {
    get repos() {
      return repos;
    },
    /** Closes and reopens the app: new repositories on the same database file. */
    restart() {
      repos = createDrizzleRepositories(wrapSqlJs(sqlite).db);
    },
    async sync(remote: RemoteStore, pageSize?: number) {
      const result = await runSync(repos.backup, remote, state, pageSize);
      state = result.state;
      return result;
    },
  };
}

const today = '2026-09-21';
const later = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('runSync', () => {
  let remote: ReturnType<typeof createFakeRemote>;
  let a: Awaited<ReturnType<typeof device>>;
  let b: Awaited<ReturnType<typeof device>>;

  beforeEach(async () => {
    remote = createFakeRemote();
    a = await device();
    b = await device();
  });

  it('copies data created on one device to another', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.repos.entries.upsert(habit.id, today, { status: 'done', note: 'ok' });
    await a.repos.tasks.create({ title: 'Pagar conta', date: today, priority: 'high' });

    const first = await a.sync(remote);
    expect(first.pushed).toBe(4); // habit, reminder, entry, task
    await b.sync(remote);

    expect((await b.repos.habits.getById(habit.id))?.reminders).toEqual(['08:00']);
    expect((await b.repos.entries.listByDate(today))[0]).toMatchObject({
      status: 'done',
      note: 'ok',
    });
    expect(await b.repos.tasks.listByRange(today, today)).toHaveLength(1);
  });

  it('is idempotent: a second round pushes and pulls nothing new', async () => {
    await a.repos.habits.create(draft());
    await a.sync(remote);
    const second = await a.sync(remote);
    expect(second.pushed).toBe(0);
    expect(second.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
  });

  it('keeps the most recent edit when both devices change the same row', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);

    await b.repos.habits.update(habit.id, draft({ name: 'Ler (B)' }));
    await later();
    await a.repos.habits.update(habit.id, draft({ name: 'Ler (A, mais recente)' }));

    await b.sync(remote);
    await a.sync(remote);
    await b.sync(remote);
    expect((await a.repos.habits.getById(habit.id))?.name).toBe('Ler (A, mais recente)');
    expect((await b.repos.habits.getById(habit.id))?.name).toBe('Ler (A, mais recente)');
  });

  it('propagates soft deletes', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);
    await later();
    await b.repos.habits.remove(habit.id);
    await b.sync(remote);
    await a.sync(remote);
    expect(await a.repos.habits.getById(habit.id)).toBeNull();
  });

  it('merges entries of the same habit and day created on both devices', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);

    await a.repos.entries.upsert(habit.id, today, { status: 'partial' });
    await later();
    await b.repos.entries.upsert(habit.id, today, { status: 'done' });
    await a.sync(remote);
    await b.sync(remote);
    await a.sync(remote);

    for (const d of [a, b]) {
      const entries = await d.repos.entries.listByDate(today);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.status).toBe('done');
    }
  });

  it('syncs settings but never device-only keys', async () => {
    await a.repos.settings.set('theme', 'dark');
    await a.repos.settings.set('activeTimer', { habitId: 'x' });
    await a.sync(remote);
    expect(remote.rows('settings').map((r) => r.key)).toEqual(['theme']);
    await b.sync(remote);
    expect(await b.repos.settings.get('theme')).toBe('dark');
    expect(await b.repos.settings.get('activeTimer')).toBeNull();
  });

  it('sends rows the cloud never got, without overwriting what the cloud has', async () => {
    // "Inglês" reaches the cloud normally and is renamed on the web afterwards.
    const english = await a.repos.habits.create(draft({ name: 'Inglês' }));
    await a.sync(remote);
    await b.sync(remote);
    await b.repos.habits.update(english.id, draft({ name: 'Inglês (web)' }));
    await b.sync(remote);
    // "Ler" and its entry never reached the cloud, but the phone believes they did (like the
    // clock-based pushes before the outbox).
    const read = await a.repos.habits.create(draft({ name: 'Ler' }));
    await a.repos.entries.upsert(read.id, today, { status: 'done', value: null });
    const { upTo } = await a.repos.backup.pendingChanges();
    await a.repos.backup.markPushed(upTo);
    expect((await a.sync(remote)).pushed).toBe(0);

    expect(await queueMissing(a.repos.backup, remote)).toBe(3); // habit, its reminder and entry
    await a.sync(remote);
    await b.sync(remote);
    expect((await b.repos.habits.list()).map((h) => h.name).sort()).toEqual([
      'Inglês (web)',
      'Ler',
    ]);
    expect(await b.repos.entries.listByDate(today)).toHaveLength(1);
    // The web's rename was not overwritten by the phone's older copy.
    expect((await a.repos.habits.list()).map((h) => h.name).sort()).toEqual([
      'Inglês (web)',
      'Ler',
    ]);
    // Once everything is there, checking again finds nothing to send.
    expect(await queueMissing(a.repos.backup, remote)).toBe(0);
  });

  it('pulls everything across several pages', async () => {
    for (let i = 0; i < 7; i++) {
      await a.repos.tasks.create({ title: `T${i}`, date: today, priority: 'normal' });
    }
    await a.sync(remote);
    await b.sync(remote, 3);
    expect(await b.repos.tasks.listByRange(today, today)).toHaveLength(7);
  });

  it('keeps the previous state when the network fails, so nothing is lost', async () => {
    await a.repos.habits.create(draft());
    remote.failNext();
    await expect(a.sync(remote)).rejects.toThrow('network error');
    const retry = await a.sync(remote);
    expect(retry.pushed).toBeGreaterThan(0);
    await b.sync(remote);
    expect(await b.repos.habits.list()).toHaveLength(1);
  });

  it('brings an existing account onto a new device without losing local data', async () => {
    await a.repos.habits.create(draft({ name: 'Da nuvem' }));
    await a.sync(remote);
    await b.repos.habits.create(draft({ name: 'Só no aparelho B' }));
    await b.sync(remote);
    expect((await b.repos.habits.list()).map((h) => h.name).sort()).toEqual([
      'Da nuvem',
      'Só no aparelho B',
    ]);
  });

  it('offline edits on the phone and on the web: the last to reach the server wins', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);

    // Both offline. The web (b) edits LATER by its clock, but the phone (a) reconnects last.
    jest.useFakeTimers({ now: new Date('2026-09-21T10:00:00Z') });
    await a.repos.habits.update(habit.id, draft({ name: 'Celular' }));
    jest.setSystemTime(new Date('2026-09-21T11:00:00Z'));
    await b.repos.habits.update(habit.id, draft({ name: 'Web' }));
    jest.useRealTimers();

    await b.sync(remote);
    await a.sync(remote);
    await b.sync(remote);
    for (const d of [a, b]) expect((await d.repos.habits.getById(habit.id))?.name).toBe('Celular');
  });

  it('never lets a device with a wrong clock win every conflict', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);

    jest.useFakeTimers({ now: new Date('2031-01-01T00:00:00Z') }); // a's clock is years ahead
    await a.repos.habits.update(habit.id, draft({ name: 'Relógio errado' }));
    jest.useRealTimers();
    await a.sync(remote);
    await b.sync(remote);
    await b.repos.habits.update(habit.id, draft({ name: 'Edição de hoje' }));
    await b.sync(remote);
    await a.sync(remote);
    for (const d of [a, b]) {
      expect((await d.repos.habits.getById(habit.id))?.name).toBe('Edição de hoje');
    }
  });

  it('pushes changes even when the device clock went backwards', async () => {
    await a.repos.habits.create(draft({ name: 'Antes' }));
    await a.sync(remote);
    jest.useFakeTimers({ now: new Date('2001-01-01T00:00:00Z') });
    await a.repos.habits.create(draft({ name: 'Relógio atrasado' }));
    jest.useRealTimers();
    expect((await a.sync(remote)).pushed).toBe(2); // habit + reminder
    await b.sync(remote);
    expect((await b.repos.habits.list()).map((h) => h.name).sort()).toEqual([
      'Antes',
      'Relógio atrasado',
    ]);
  });

  it('keeps pending changes across an app restart', async () => {
    await a.repos.habits.create(draft({ name: 'Feito offline' }));
    a.restart();
    expect((await a.sync(remote)).pushed).toBe(2);
    await b.sync(remote);
    expect((await b.repos.habits.list())[0]?.name).toBe('Feito offline');
  });

  it('does not lose a change made while a sync is pushing', async () => {
    const habit = await a.repos.habits.create(draft());
    const upsert = remote.upsert.bind(remote);
    let edited = false;
    const racing: RemoteStore = {
      ...remote,
      async upsert(table, rows) {
        if (!edited) {
          edited = true;
          await a.repos.habits.update(habit.id, draft({ name: 'Durante o sync' }));
        }
        return upsert(table, rows);
      },
    };
    await a.sync(racing);
    expect((await a.sync(remote)).pushed).toBeGreaterThan(0);
    await b.sync(remote);
    expect((await b.repos.habits.getById(habit.id))?.name).toBe('Durante o sync');
  });

  it('keeps a local edit waiting to be pushed when the pull brings another version', async () => {
    const habit = await a.repos.habits.create(draft());
    await a.sync(remote);
    await b.sync(remote);
    await b.repos.habits.update(habit.id, draft({ name: 'B' }));
    await b.sync(remote);

    // a's push is done; while it pulls b's version, the user edits the same habit on a.
    const pull = remote.pull.bind(remote);
    let edited = false;
    const racing: RemoteStore = {
      ...remote,
      async pull(table, since, inclusive, limit) {
        if (!edited) {
          edited = true;
          await a.repos.habits.update(habit.id, draft({ name: 'A pendente' }));
        }
        return pull(table, since, inclusive, limit);
      },
    };
    await a.sync(racing);
    expect((await a.repos.habits.getById(habit.id))?.name).toBe('A pendente');

    await a.sync(remote);
    await b.sync(remote);
    for (const d of [a, b])
      expect((await d.repos.habits.getById(habit.id))?.name).toBe('A pendente');
  });

  it('never pushes back rows it just pulled, and repeated rounds change nothing', async () => {
    await a.repos.habits.create(draft());
    await a.repos.settings.set('theme', 'dark');
    await a.sync(remote);
    await b.sync(remote);
    const writes = remote.rows('habits')[0]?.server_updated_at;
    for (let i = 0; i < 3; i++) {
      const round = await b.sync(remote);
      expect(round.pushed).toBe(0);
      expect(round.applied).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    }
    expect(remote.rows('habits')[0]?.server_updated_at).toBe(writes);
    expect(remote.rows('habits')).toHaveLength(1);
  });

  it('redoes an interrupted push without duplicating anything', async () => {
    for (let i = 0; i < 5; i++)
      await a.repos.tasks.create({ title: `T${i}`, date: today, priority: 'normal' });
    await a.repos.habits.create(draft());
    let calls = 0;
    const flaky: RemoteStore = {
      ...remote,
      async upsert(table, rows) {
        calls += 1;
        if (calls === 3) throw new Error('connection reset'); // after habits + reminders
        return remote.upsert(table, rows);
      },
    };
    await expect(a.sync(flaky)).rejects.toThrow('connection reset');
    await a.sync(remote);
    await a.sync(remote);
    expect(remote.rows('tasks')).toHaveLength(5);
    expect(remote.rows('habits')).toHaveLength(1);
    await b.sync(remote);
    expect(await b.repos.tasks.listByRange(today, today)).toHaveLength(5);
  });
});
