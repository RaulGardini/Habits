import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayLocal } from '@/core/dates/localDate';

/**
 * Current time, refreshed every `intervalMs` (default: 1 minute). Ticks are aligned to the
 * interval boundary, so a new minute — and a new day at midnight — shows up right away, and
 * the time is refreshed when the app returns to the foreground (timers are paused in the
 * background, and the device time zone may have changed meanwhile).
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    const tick = () => {
      setNow(new Date());
      schedule();
    };
    schedule();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      clearTimeout(timer);
      tick();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [intervalMs]);
  return now;
}

/** Today's local date; updates at midnight. */
export function useToday(): string {
  return todayLocal(useNow());
}
