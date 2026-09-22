import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatNumber, parseDecimal } from '@/core/format';
import { linkedGoalUnit, TITLE_MAX_LENGTH, validateGoalDraft } from '@/core/planner/planner';
import type { Habit } from '@/core/habits/types';
import type { Goal, GoalDraft, GoalScope } from '@/core/planner/types';
import { UNIT_MAX_LENGTH } from '@/core/habits/validation';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { goBack } from '@/lib/navigation';
import { useActiveHabits } from '@/stores/habitsStore';
import { plannerActions, useGoal } from '@/stores/plannerStore';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { confirm, showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { t } from '@/i18n/i18n';

/** "Conta automaticamente as vezes que você concluir “Academia” no período." */
function describeLinkedProgress(habit: Habit): string {
  const what =
    habit.tracking.type === 'boolean'
      ? t('as vezes que você concluir')
      : habit.tracking.type === 'quantity'
        ? `a quantidade (${linkedGoalUnit(habit)}) registrada em`
        : 'as horas registradas em';
  return t('Conta automaticamente {what} “{habit}” no período.', { what, habit: habit.name });
}

export function NewGoalScreen({ scope, period }: { scope: GoalScope; period: string }) {
  return (
    <GoalForm
      initial={{ title: '', scope, period, target: 1, unit: null, habitId: null }}
      targetText=""
    />
  );
}

export function EditGoalScreen({ id }: { id: string }) {
  const goal = useGoal(id);
  if (goal === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title={t('Carregando…')} />
      </Screen>
    );
  }
  return (
    <GoalForm key={goal.id} goal={goal} initial={goal} targetText={formatNumber(goal.target)} />
  );
}

function GoalForm({
  goal,
  initial,
  targetText: initialTargetText,
}: {
  goal?: Goal;
  initial: GoalDraft;
  targetText: string;
}) {
  const habits = useActiveHabits();
  const [draft, setDraft] = useState<GoalDraft>({
    title: initial.title,
    scope: initial.scope,
    period: initial.period,
    target: initial.target,
    unit: initial.unit,
    habitId: initial.habitId,
  });
  const [targetText, setTargetText] = useState(initialTargetText);
  const [errors, setErrors] = useState<Partial<Record<keyof GoalDraft, string>>>({});
  const linkedHabit = habits.find((h) => h.id === draft.habitId);

  const save = async () => {
    const next = { ...draft, target: parseDecimal(targetText) };
    const validation = validateGoalDraft(next);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    try {
      if (goal) await plannerActions.updateGoal(goal.id, next);
      else await plannerActions.createGoal(next);
      goBack();
    } catch (error) {
      showError(t('Não foi possível salvar a meta.'), error);
    }
  };

  const remove = async () => {
    if (!goal) return;
    const ok = await confirm({
      title: t('Excluir meta?'),
      message: t('"{title}" será removida.', { title: goal.title }),
      confirmLabel: t('Excluir'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await plannerActions.removeGoal(goal.id);
      goBack();
    } catch (error) {
      showError(t('Não foi possível excluir a meta.'), error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <AppText tone="muted">
        Meta{' '}
        {draft.scope === 'month'
          ? t('do mês {period}', { period: draft.period })
          : t('do ano {period}', { period: draft.period })}
      </AppText>
      <TextField
        label={t('Título')}
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
        placeholder={t('Ex: Ler 12 livros')}
        maxLength={TITLE_MAX_LENGTH}
        error={errors.title}
        autoFocus={!goal}
      />

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          {t('Vincular a um hábito (progresso automático)')}
        </AppText>
        <View style={styles.chips}>
          <Chip
            label={t('Nenhum')}
            selected={draft.habitId === null}
            onPress={() => setDraft({ ...draft, habitId: null })}
          />
          {habits.map((habit) => (
            <Chip
              key={habit.id}
              label={habit.name}
              selected={draft.habitId === habit.id}
              onPress={() => setDraft({ ...draft, habitId: habit.id })}
            />
          ))}
        </View>
        {linkedHabit ? (
          <View style={styles.linked}>
            <HabitIcon icon={linkedHabit.icon} color={linkedHabit.color} size={24} />
            <AppText variant="caption" tone="muted" style={styles.flex}>
              {describeLinkedProgress(linkedHabit)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('Meta')}
            value={targetText}
            onChangeText={setTargetText}
            keyboardType="decimal-pad"
            placeholder="12"
            error={errors.target}
          />
        </View>
        {linkedHabit ? null : (
          <View style={styles.flex}>
            <TextField
              label={t('Unidade (opcional)')}
              value={draft.unit ?? ''}
              onChangeText={(unit) => setDraft({ ...draft, unit })}
              placeholder={t('livros, km…')}
              maxLength={UNIT_MAX_LENGTH}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button label={goal ? t('Salvar') : t('Criar meta')} onPress={save} />
        {goal ? (
          <Button variant="danger" icon="trash-can-outline" label={t('Excluir')} onPress={remove} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  linked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
