import { useLocalSearchParams } from 'expo-router';

import { todayLocal } from '@/core/dates/localDate';
import { goalPeriodOf } from '@/core/planner/planner';
import { NewGoalScreen } from '@/features/goals/GoalFormScreen';

export default function NewGoalRoute() {
  const params = useLocalSearchParams<{ scope?: string; period?: string }>();
  const scope = params.scope === 'year' ? 'year' : 'month';
  const period = params.period ?? goalPeriodOf(todayLocal(), scope);
  return <NewGoalScreen scope={scope} period={period} />;
}
