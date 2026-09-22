import { useLocalSearchParams } from 'expo-router';

import { EditGoalScreen } from '@/features/goals/GoalFormScreen';

export default function EditGoalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditGoalScreen id={id} />;
}
