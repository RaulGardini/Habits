import { useLocalSearchParams } from 'expo-router';

import { isLocalDate, todayLocal } from '@/core/dates/localDate';
import { NewEventScreen } from '@/features/agenda/EventFormScreen';

export default function NewEventRoute() {
  const { date, hour } = useLocalSearchParams<{ date?: string; hour?: string }>();
  const parsedHour = hour !== undefined ? Number(hour) : NaN;
  return (
    <NewEventScreen
      date={date && isLocalDate(date) ? date : todayLocal()}
      hour={
        Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour < 24 ? parsedHour : undefined
      }
    />
  );
}
