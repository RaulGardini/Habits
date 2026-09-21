import { useLocalSearchParams } from 'expo-router';

import { EditGoalScreen } from '@/features/planner/GoalFormScreen';

export default function EditGoalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditGoalScreen id={id} />;
}
