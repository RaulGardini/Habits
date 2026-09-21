import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { parseLocalDate, type LocalDate } from '@/core/dates/localDate';
import { nextDay, sortTasks, TITLE_MAX_LENGTH } from '@/core/planner/planner';
import type { Task, TaskPriority } from '@/core/planner/types';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { plannerActions } from '@/stores/plannerStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { showError } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { TextField } from '@/ui/TextField';

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

interface TaskListProps {
  date: LocalDate;
  tasks: readonly Task[];
}

export function TaskList({ date, tasks }: TaskListProps) {
  const [title, setTitle] = useState('');
  const sorted = sortTasks(tasks);
  const pending = sorted.filter((t) => t.completedAt === null);

  const add = () => {
    if (!title.trim()) return;
    plannerActions
      .createTask({ title, date, priority: 'normal' })
      .then(() => setTitle(''))
      .catch((error: unknown) => showError('Não foi possível criar a tarefa.', error));
  };

  const rollOver = () =>
    plannerActions
      .moveTasks(
        pending.map((t) => t.id),
        nextDay(date),
      )
      .catch((error: unknown) => showError('Não foi possível mover as tarefas.', error));

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            label="Nova tarefa"
            value={title}
            onChangeText={setTitle}
            placeholder="O que precisa ser feito?"
            maxLength={TITLE_MAX_LENGTH}
            onSubmitEditing={add}
            returnKeyType="done"
            blurOnSubmit={false}
          />
        </View>
        <IconButton icon="plus-circle" label="Adicionar tarefa" onPress={add} size={32} />
      </View>

      {sorted.length === 0 ? (
        <AppText tone="muted">Nenhuma tarefa para este dia.</AppText>
      ) : (
        sorted.map((task) => <TaskItem key={task.id} task={task} />)
      )}

      {pending.length > 0 ? (
        <Button
          variant="ghost"
          icon="calendar-arrow-right"
          label={`Rolar ${pending.length} pendente${pending.length === 1 ? '' : 's'} para amanhã`}
          onPress={rollOver}
        />
      ) : null}
    </View>
  );
}

function TaskItem({ task }: { task: Task }) {
  const { colors } = useTheme();
  const done = task.completedAt !== null;
  const priorityColor =
    task.priority === 'high' ? colors.danger : task.priority === 'low' ? colors.textMuted : null;

  const toggle = () => {
    if (done) hapticLight();
    else hapticSuccess();
    plannerActions
      .setTaskCompleted(task.id, !done)
      .catch((error: unknown) => showError('Não foi possível salvar a tarefa.', error));
  };

  return (
    <View style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: done }}
        style={styles.checkArea}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: done ? colors.primary : colors.textMuted },
            done && { backgroundColor: colors.primary },
          ]}
        >
          {done ? <Icon name="check-bold" size={16} color={colors.onPrimary} /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Editar tarefa ${task.title}`}
        style={styles.texts}
      >
        <AppText
          style={done ? [styles.done, { color: colors.textMuted }] : undefined}
          numberOfLines={3}
        >
          {task.title}
        </AppText>
        {priorityColor || task.rolledFrom ? (
          <View style={styles.meta}>
            {priorityColor ? (
              <>
                <Icon name="flag" size={14} color={priorityColor} />
                <AppText variant="caption" tone="muted">
                  {PRIORITY_LABEL[task.priority]}
                </AppText>
              </>
            ) : null}
            {task.rolledFrom ? (
              <AppText variant="caption" tone="muted">
                Adiada de {format(parseLocalDate(task.rolledFrom), 'dd/MM')}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {!done ? (
        <IconButton
          icon="arrow-right-bold-circle-outline"
          label={`Mover ${task.title} para amanhã`}
          color={colors.textMuted}
          onPress={() =>
            plannerActions
              .moveTasks([task.id], nextDay(task.date))
              .catch((error: unknown) => showError('Não foi possível mover a tarefa.', error))
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  flex: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingRight: spacing.xs,
    minHeight: MIN_TOUCH_SIZE + 4,
  },
  checkArea: {
    width: MIN_TOUCH_SIZE + 4,
    minHeight: MIN_TOUCH_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, paddingVertical: spacing.sm, gap: 2 },
  done: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
