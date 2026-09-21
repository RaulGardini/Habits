export type DayPeriod = 'morning' | 'afternoon' | 'evening';

/** Hour (inclusive) at which each period starts. Evening wraps past midnight. */
export const DAY_PERIOD_START_HOUR: Record<DayPeriod, number> = {
  morning: 5,
  afternoon: 12,
  evening: 18,
};

export function getDayPeriod(now: Date): DayPeriod {
  const hour = now.getHours();
  if (hour >= DAY_PERIOD_START_HOUR.morning && hour < DAY_PERIOD_START_HOUR.afternoon) {
    return 'morning';
  }
  if (hour >= DAY_PERIOD_START_HOUR.afternoon && hour < DAY_PERIOD_START_HOUR.evening) {
    return 'afternoon';
  }
  return 'evening';
}
