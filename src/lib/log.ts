/**
 * The only place the app writes to the console. Error messages can carry personal data — a
 * failed Drizzle query includes its parameters (a habit name, the text of a note) and Postgres
 * errors may include the failing row — so production logs keep just the context and the
 * error's type/code. Development keeps everything. (ESLint forbids `console` elsewhere.)
 */
export function logError(context: string, error?: unknown): void {
  if (__DEV__) {
    console.error(context, error);
    return;
  }
  console.error(error === undefined ? context : `${context}: ${describeError(error)}`);
}

/** "DrizzleQueryError (SQLITE_CONSTRAINT)" — never the message itself. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const codes = [error, (error as { cause?: unknown }).cause]
    .map((item) => (item as { code?: unknown } | undefined)?.code)
    .filter((code) => typeof code === 'string' || typeof code === 'number');
  return codes.length > 0 ? `${error.name} (${codes.join(', ')})` : error.name;
}
