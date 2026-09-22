import { useState } from 'react';

import { todayLocal } from '@/core/dates/localDate';
import type { HabitDraft } from '@/core/habits/types';
import { goBack } from '@/lib/navigation';
import { useHabitsStore } from '@/stores/habitsStore';
import { DEFAULT_HABIT_COLOR } from '@/theme/habitColors';
import { showError } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';

import { DEFAULT_HABIT_ICON } from './habitIcons';
import { HabitForm } from './HabitForm';
import { t } from '@/i18n/i18n';

export function NewHabitScreen() {
  const create = useHabitsStore((state) => state.create);
  const [initial] = useState<HabitDraft>(() => ({
    name: '',
    icon: DEFAULT_HABIT_ICON,
    color: DEFAULT_HABIT_COLOR,
    timeOfDay: 'anytime',
    frequency: { type: 'daily' },
    tracking: { type: 'boolean' },
    startDate: todayLocal(),
    reminders: [],
  }));

  const submit = async (draft: HabitDraft) => {
    try {
      await create(draft);
      goBack();
    } catch (error) {
      showError(t('Não foi possível criar o hábito.'), error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <HabitForm initial={initial} submitLabel={t('Criar hábito')} onSubmit={submit} />
    </Screen>
  );
}
