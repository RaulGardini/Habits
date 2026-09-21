import { useLocalSearchParams } from 'expo-router';

import { EditHabitScreen } from '@/features/habits/EditHabitScreen';

export default function EditHabitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditHabitScreen id={id} />;
}
