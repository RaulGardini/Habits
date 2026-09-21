import { goBack } from '@/lib/navigation';
import { useState } from 'react';

import { todayLocal } from '@/core/dates/localDate';
import type { HabitDraft } from '@/core/habits/types';
import { useHabitsStore } from '@/stores/habitsStore';
import { DEFAULT_HABIT_COLOR } from '@/theme/habitColors';
import { showError } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';

import { DEFAULT_HABIT_ICON } from './habitIcons';
import { HabitForm } from './HabitForm';

export function NewHabitScreen() {
  const create = useHabitsStore((state) => state.create);
  const [initial] = useState<HabitDraft>(() => ({
    name: '',
    icon: DEFAULT_HABIT_ICON,
    color: DEFAULT_HABIT_COLOR,
    timeOfDay: 'anytime',
    startDate: todayLocal(),
  }));

  const submit = async (draft: HabitDraft) => {
    try {
      await create(draft);
      goBack();
    } catch (error) {
      showError('Não foi possível criar o hábito.', error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <HabitForm initial={initial} submitLabel="Criar hábito" onSubmit={submit} />
    </Screen>
  );
}
