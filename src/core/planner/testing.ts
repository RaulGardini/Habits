import type { PlannerEvent } from './types';
import { t } from '@/i18n/i18n';

/** Test builder for events (one-off, 09:00, no reminder). */
export function makeEvent(patch: Partial<PlannerEvent> = {}): PlannerEvent {
  return {
    id: 'e',
    title: t('Evento'),
    date: '2026-09-21',
    allDay: false,
    startTime: '09:00',
    endTime: null,
    location: null,
    color: 'blue',
    note: null,
    repeat: 'none',
    repeatUntil: null,
    excludedDates: [],
    reminderMinutes: null,
    createdAt: '',
    updatedAt: '',
    ...patch,
  };
}
