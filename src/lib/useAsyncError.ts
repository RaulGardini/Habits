import { useCallback, useState } from 'react';

import { logError } from './log';

/**
 * Hands a failed load to the screen's error boundary (the "Tentar de novo" screen) instead of
 * leaving a spinner forever: the returned function logs the error and rethrows it on the next
 * render. Retrying remounts the screen, which loads again.
 */
export function useAsyncError(context: string): (error: unknown) => void {
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const fail = useCallback(
    (error: unknown) => {
      logError(context, error);
      setFailure({ error });
    },
    [context],
  );
  if (failure) throw failure.error;
  return fail;
}
