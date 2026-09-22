import {
  authErrorMessage,
  chunk,
  pushableRows,
  toCamelCase,
  toLocalRow,
  toRemoteRow,
  toSnakeCase,
  validateCredentials,
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
