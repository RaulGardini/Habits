import { useLocalSearchParams } from 'expo-router';

import { isLocalDate, todayLocal } from '@/core/dates/localDate';
import { EntryScreen } from '@/features/today/EntryScreen';

export default function EntryRoute() {
  const { habitId, date } = useLocalSearchParams<{ habitId: string; date: string }>();
  return <EntryScreen habitId={habitId} date={date && isLocalDate(date) ? date : todayLocal()} />;
}
