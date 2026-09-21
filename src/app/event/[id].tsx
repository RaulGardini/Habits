import { useLocalSearchParams } from 'expo-router';

import { EditEventScreen } from '@/features/planner/EventFormScreen';

export default function EditEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditEventScreen id={id} />;
}
