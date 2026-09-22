import { StyleSheet, View } from 'react-native';

import type { HabitDraft } from '@/core/habits/types';
import { goBack } from '@/lib/navigation';
import { useHabitsStore } from '@/stores/habitsStore';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { confirm, showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

import { HabitForm } from './HabitForm';
import { t } from '@/i18n/i18n';

export function EditHabitScreen({ id }: { id: string }) {
  const habit = useHabitsStore((state) => state.habits.find((h) => h.id === id));
  const update = useHabitsStore((state) => state.update);
  const setArchived = useHabitsStore((state) => state.setArchived);
  const remove = useHabitsStore((state) => state.remove);

  if (!habit) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title={t('Hábito não encontrado')} />
      </Screen>
    );
  }

  const initial: HabitDraft = {
    name: habit.name,
    icon: habit.icon,
    color: habit.color,
    timeOfDay: habit.timeOfDay,
    frequency: habit.frequency,
    tracking: habit.tracking,
    startDate: habit.startDate,
    reminders: habit.reminders,
  };
  const isArchived = habit.archivedAt !== null;

  const submit = async (draft: HabitDraft) => {
    try {
      await update(habit.id, draft);
      goBack();
    } catch (error) {
      showError(t('Não foi possível salvar as alterações.'), error);
    }
  };

  const toggleArchive = async () => {
    try {
      await setArchived(habit.id, !isArchived);
      goBack();
    } catch (error) {
      showError(t('Não foi possível arquivar o hábito.'), error);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t('Excluir hábito?'),
      message: t(
        '"{name}" e todo o seu histórico deixarão de aparecer. Se quiser só pausar, arquive o hábito.',
        { name: habit.name },
      ),
      confirmLabel: t('Excluir'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(habit.id);
      goBack();
    } catch (error) {
      showError(t('Não foi possível excluir o hábito.'), error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <HabitForm key={habit.id} initial={initial} submitLabel={t('Salvar')} onSubmit={submit} />
      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon={isArchived ? 'archive-arrow-up-outline' : 'archive-outline'}
          label={isArchived ? 'Desarquivar' : 'Arquivar'}
          accessibilityHint={t('Arquivar esconde o hábito sem apagar o histórico')}
          onPress={toggleArchive}
        />
        <Button
          variant="danger"
          icon="trash-can-outline"
          label={t('Excluir')}
          onPress={handleDelete}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, marginTop: spacing.lg },
});
