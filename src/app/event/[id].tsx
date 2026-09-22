import { useLocalSearchParams } from 'expo-router';

import { isLocalDate } from '@/core/dates/localDate';
import { EditEventScreen } from '@/features/agenda/EventFormScreen';

export default function EditEventRoute() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  return <EditEventScreen id={id} date={date && isLocalDate(date) ? date : undefined} />;
}
