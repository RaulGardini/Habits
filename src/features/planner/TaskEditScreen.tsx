import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { todayLocal } from '@/core/dates/localDate';
import { TITLE_MAX_LENGTH, validateTaskDraft } from '@/core/planner/planner';
import type { Task, TaskDraft, TaskPriority } from '@/core/planner/types';
import { DateStepper } from '@/features/habits/DateStepper';
import { goBack } from '@/lib/navigation';
import { plannerActions, useTask } from '@/stores/plannerStore';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { confirm, showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';

import { PRIORITY_LABEL } from './TaskList';

const PRIORITY_OPTIONS = (['high', 'normal', 'low'] as const).map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
  icon: value === 'high' ? 'flag' : value === 'low' ? 'flag-outline' : 'flag-variant-outline',
}));

export function TaskEditScreen({ id }: { id: string }) {
  const task = useTask(id);
  if (task === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title="Carregando…" />
      </Screen>
    );
  }
  return <TaskForm key={task.id} task={task} />;
}

function TaskForm({ task }: { task: Task }) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: task.title,
    date: task.date,
    priority: task.priority,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TaskDraft, string>>>({});

  const save = async () => {
    const next = validateTaskDraft(draft);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await plannerActions.updateTask(task.id, draft);
      goBack();
    } catch (error) {
      showError('Não foi possível salvar a tarefa.', error);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Excluir tarefa?',
      message: `"${task.title}" será removida.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await plannerActions.removeTask(task.id);
      goBack();
    } catch (error) {
      showError('Não foi possível excluir a tarefa.', error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <TextField
        label="Título"
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
        maxLength={TITLE_MAX_LENGTH}
        error={errors.title}
      />
      <SegmentedControl<TaskPriority>
        label="Prioridade"
        options={PRIORITY_OPTIONS}
        value={draft.priority}
        onChange={(priority) => setDraft({ ...draft, priority })}
      />
      <DateStepper
        label="Dia"
        value={draft.date}
        today={todayLocal()}
        onChange={(date) => setDraft({ ...draft, date })}
      />
      <View style={styles.actions}>
        <Button label="Salvar" onPress={save} />
        <Button variant="danger" icon="trash-can-outline" label="Excluir" onPress={remove} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, marginTop: spacing.md },
});
