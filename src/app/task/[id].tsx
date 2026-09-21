import { useLocalSearchParams } from 'expo-router';

import { TaskEditScreen } from '@/features/planner/TaskEditScreen';

export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskEditScreen id={id} />;
}
