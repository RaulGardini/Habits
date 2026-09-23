import {
  authErrorMessage,
  chunk,
  pushableRows,
  toCamelCase,
  toLocalRow,
  toRemoteRow,
  toSnakeCase,
  validateCredentials,
  planRemoteApply,
  retryDelayMs,
} from './sync';

describe('case conversion', () => {
  it('converts column names both ways', () => {
    expect(toSnakeCase('frequencyWeekdays')).toBe('frequency_weekdays');
    expect(toCamelCase('server_updated_at')).toBe('serverUpdatedAt');
  });

  it('maps rows and drops server-only columns', () => {
    const remote = toRemoteRow({ id: 'h', startDate: '2026-09-01', updatedAt: 'x' });
    expect(remote).toEqual({ id: 'h', start_date: '2026-09-01', updated_at: 'x' });
    expect(
      toLocalRow({ ...remote, user_id: 'u', server_updated_at: '2026-01-01T00:00:00+00:00' }),
    ).toEqual({ id: 'h', startDate: '2026-09-01', updatedAt: 'x' });
  });
});

describe('pushableRows', () => {
  it('filters device-only settings', () => {
    const rows = [
      { key: 'theme', updatedAt: 'x' },
      { key: 'activeTimer', updatedAt: 'x' },
      { key: 'syncState', updatedAt: 'x' },
    ];
    expect(pushableRows('settings', rows).map((r) => r.key)).toEqual(['theme']);
    expect(pushableRows('tasks', rows)).toHaveLength(3);
  });
});

describe('chunk', () => {
  it('splits into fixed-size parts', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('credentials and errors', () => {
  it('validates e-mail and password', () => {
    expect(validateCredentials('a@b.co', '123456')).toBeNull();
    expect(validateCredentials('nope', '123456')).toBeDefined();
    expect(validateCredentials('a@b.co', '123')).toContain('6 caracteres');
  });

  it('translates common Supabase auth errors', () => {
    expect(authErrorMessage('Invalid login credentials')).toBe('E-mail ou senha incorretos.');
    expect(authErrorMessage('User already registered')).toContain('Já existe');
    expect(authErrorMessage('something else')).toContain('Tente novamente');
  });
});

describe('planRemoteApply', () => {
  type Row = { id: string; name: string; updatedAt: string };
  const row = (id: string, name: string, updatedAt = '2026-01-01'): Row => ({
    id,
    name,
    updatedAt,
  });
  const byId = (r: Row) => r.id;
  const never = () => false;

  it('lets the server order win, whatever the device clocks say', () => {
    // The incoming row has an OLDER client timestamp but reached the server later.
    const plan = planRemoteApply(
      [row('a', 'local', '2030-01-01')],
      [row('a', 'server', '2020-01-01')],
      byId,
      never,
      'id',
    );
    expect(plan.toUpdate).toEqual([
      { existing: row('a', 'local', '2030-01-01'), incoming: row('a', 'server', '2020-01-01') },
    ]);
  });

  it('keeps the last of several versions of the same row', () => {
    const plan = planRemoteApply(
      [],
      [row('a', 'first'), row('b', 'b'), row('a', 'second')],
      byId,
      never,
      'id',
    );
    expect(plan.toInsert.map((r) => r.name)).toEqual(['second', 'b']);
    expect(plan.skipped).toBe(1);
  });

  it('keeps local rows with changes waiting to be pushed', () => {
    const plan = planRemoteApply(
      [row('a', 'offline edit')],
      [row('a', 'server')],
      byId,
      (r) => r.id === 'a',
      'id',
    );
    expect(plan).toEqual({ toInsert: [], toUpdate: [], skipped: 1 });
  });

  it('skips rows that did not change (our own push coming back)', () => {
    const plan = planRemoteApply([row('a', 'same')], [row('a', 'same')], byId, never, 'id');
    expect(plan).toEqual({ toInsert: [], toUpdate: [], skipped: 1 });
  });
});

describe('retryDelayMs', () => {
  it('doubles from 2 s up to 5 min', () => {
    const middle = () => 0.5;
    expect([0, 1, 2, 3, 10, 50].map((n) => retryDelayMs(n, middle))).toEqual([
      2_000, 4_000, 8_000, 16_000, 300_000, 300_000,
    ]);
  });

  it('adds ±20% jitter', () => {
    expect(retryDelayMs(0, () => 0)).toBe(1_600);
    expect(retryDelayMs(0, () => 1)).toBe(2_400);
  });
});
