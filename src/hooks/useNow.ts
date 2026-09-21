import { useEffect, useState } from 'react';

import { todayLocal } from '@/core/dates/localDate';

/** Current time, refreshed every `intervalMs` (default: 1 minute). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Today's local date; updates after midnight. */
export function useToday(): string {
  return todayLocal(useNow());
}
