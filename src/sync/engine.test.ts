import { INITIAL_SYNC_STATE, type SyncState } from '@/core/sync/sync';
import type { HabitDraft } from '@/core/habits/types';
import { createTestDatabase } from '@/db/testing';
import { createDrizzleRepositories } from '@/repositories/drizzle';

import { runSync, type RemoteStore } from './engine';
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
  const repos = createDrizzleRepositories(await createTestDatabase());
  let state: SyncState = INITIAL_SYNC_STATE;
  return {
    repos,
    async sync(remote: RemoteStore, pageSize?: number) {
      const result = await runSync(repos.backup, remote, state, undefined, pageSize);
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
});
