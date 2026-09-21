import { hasWeekday, orderedWeekdays, weekdayShort } from '@/core/dates/weekdays';
import { formatDuration, formatNumber } from '@/core/format';
import type { Streaks } from '@/core/habits/streaks';
import type {
  EntryStatus,
  Frequency,
  TimeOfDay,
  Tracking,
  WeekStartsOn,
} from '@/core/habits/types';

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  anytime: 'Qualquer hora',
};

export const TIME_OF_DAY_ICON: Record<TimeOfDay, string> = {
  morning: 'weather-sunset-up',
  afternoon: 'white-balance-sunny',
  evening: 'weather-night',
  anytime: 'clock-outline',
};

export const STATUS_LABEL: Record<EntryStatus, string> = {
  done: 'Concluído',
  partial: 'Parcial',
  skipped: 'Pulado',
  missed: 'Não feito',
};

export const STATUS_ICON: Record<EntryStatus, string> = {
  done: 'check-circle',
  partial: 'progress-check',
  skipped: 'skip-next-circle-outline',
  missed: 'close-circle-outline',
};

/** "Todo dia", "Seg, Qua, Sex", "3x por semana", "A cada 2 dias". */
export function describeFrequency(frequency: Frequency, weekStartsOn: WeekStartsOn = 0): string {
  switch (frequency.type) {
    case 'daily':
      return 'Todo dia';
    case 'weekdays': {
      const days = orderedWeekdays(weekStartsOn).filter((d) => hasWeekday(frequency.days, d));
      if (days.length === 7) return 'Todo dia';
      return days.map(weekdayShort).join(', ');
    }
    case 'per_period':
      return `${frequency.count}x por ${frequency.period === 'week' ? 'semana' : 'mês'}`;
    case 'interval':
      return `A cada ${frequency.every} dias`;
  }
}

/** Target description: "2 L", "30 min"; null for yes/no. */
export function describeTarget(tracking: Tracking): string | null {
  switch (tracking.type) {
    case 'boolean':
      return null;
    case 'quantity':
      return `${formatNumber(tracking.target)} ${tracking.unit}`;
    case 'timer':
      return formatDuration(tracking.targetSeconds);
  }
}

/** Value in the habit's unit: "1,5 L", "12 min". */
export function describeValue(tracking: Tracking, value: number): string {
  switch (tracking.type) {
    case 'boolean':
      return '';
    case 'quantity':
      return `${formatNumber(value)} ${tracking.unit}`;
    case 'timer':
      return formatDuration(value);
  }
}

/** "5 dias", "1 semana", "2 meses". */
export function describeStreak(count: number, unit: Streaks['unit']): string {
  const words = { day: ['dia', 'dias'], week: ['semana', 'semanas'], month: ['mês', 'meses'] };
  const [singular, plural] = words[unit];
  return `${count} ${count === 1 ? singular : plural}`;
}
