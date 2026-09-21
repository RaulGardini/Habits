import type { TimeOfDay } from '@/core/habits/types';

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
