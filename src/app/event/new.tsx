import { useLocalSearchParams } from 'expo-router';

import { isLocalDate, todayLocal } from '@/core/dates/localDate';
import { NewEventScreen } from '@/features/planner/EventFormScreen';

export default function NewEventRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <NewEventScreen date={date && isLocalDate(date) ? date : todayLocal()} />;
}
