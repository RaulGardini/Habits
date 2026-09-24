import { describeError, logError } from './log';

const secretNote = 'Consulta no psiquiatra às 15h';

it('describes an error by its type and code, never its message', () => {
  const query = Object.assign(new Error(`Failed query: insert … params: ${secretNote}`), {
    name: 'DrizzleQueryError',
    cause: Object.assign(new Error('UNIQUE constraint failed'), { code: 'SQLITE_CONSTRAINT' }),
  });
  expect(describeError(query)).toBe('DrizzleQueryError (SQLITE_CONSTRAINT)');
  expect(describeError(new TypeError(secretNote))).toBe('TypeError');
  expect(describeError(secretNote)).toBe('string');
});

it('keeps personal data out of production logs', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const global = globalThis as unknown as { __DEV__: boolean };
  const dev = global.__DEV__;
  global.__DEV__ = false;
  try {
    logError('Failed to save entry', new Error(secretNote));
    expect(spy).toHaveBeenCalledWith('Failed to save entry: Error');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('psiquiatra');
  } finally {
    global.__DEV__ = dev;
    spy.mockRestore();
  }
});
