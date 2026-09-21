import { useLocalSearchParams } from 'expo-router';

import { HabitStatsScreen } from '@/features/stats/HabitStatsScreen';

export default function HabitStatsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitStatsScreen id={id} />;
}
