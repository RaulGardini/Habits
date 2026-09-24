import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatNumber } from '@/core/format';
import { goalPeriodRange, goalProgress } from '@/core/planner/planner';
import type { Goal, GoalScope } from '@/core/planner/types';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { plannerActions, useGoals } from '@/stores/plannerStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, softShadow, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { showError } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { ProgressBar } from '@/ui/ProgressBar';
import { t } from '@/i18n/i18n';

interface GoalsSectionProps {
  scope: GoalScope;
  /** `YYYY-MM` or `YYYY`. */
  period: string;
}

export function GoalsSection({ scope, period }: GoalsSectionProps) {
  const goals = useGoals(scope, period);
  const range = goalPeriodRange(scope, period);
  const entries = useEntriesInRange(range.from, range.to);

  return (
    <View style={styles.container}>
      {goals && goals.length === 0 ? (
        <AppText tone="muted">
          Nenhuma meta {scope === 'month' ? t('para este mês') : t('para este ano')}.
        </AppText>
      ) : null}
      {(goals ?? []).map((goal) => (
        <GoalItem key={goal.id} goal={goal} entries={entries ?? []} />
      ))}
      <Button
        variant="ghost"
        icon="flag-plus-outline"
        label={t('Nova meta')}
        onPress={() => router.push({ pathname: '/goal/new', params: { scope, period } })}
      />
    </View>
  );
}

function GoalItem({ goal, entries }: { goal: Goal; entries: Parameters<typeof goalProgress>[2] }) {
  const { colors } = useTheme();
  const habit = useHabitsStore((state) => state.habits.find((h) => h.id === goal.habitId));
  const progress = goalProgress(goal, habit, entries);
  const linked = goal.habitId !== null && habit !== undefined;
  const valueText = `${formatNumber(progress.current)} / ${formatNumber(progress.target)}${
    progress.unit ? ` ${progress.unit}` : ''
  }`;

  const change = (delta: number) => {
    const next = Math.max(0, goal.current + delta);
    if (next >= goal.target && goal.current < goal.target) hapticSuccess();
    else hapticLight();
    plannerActions
      .setGoalCurrent(goal.id, next)
      .catch((error: unknown) => showError(t('Não foi possível atualizar a meta.'), error));
  };

  return (
    <View
      style={[
        styles.item,
        { backgroundColor: colors.surface, boxShadow: softShadow(colors.shadow) },
      ]}
    >
      <Pressable
        onPress={() => router.push(`/goal/${goal.id}`)}
        accessibilityRole="button"
        accessibilityLabel={t('Editar meta {title}: {value}', {
          title: goal.title,
          value: valueText,
        })}
        style={styles.main}
      >
        <View style={styles.titleRow}>
          {linked ? (
            <HabitIcon icon={habit.icon} color={habit.color} size={24} />
          ) : (
            <Icon
              name={progress.achieved ? 'trophy' : 'flag-outline'}
              size={22}
              color={progress.achieved ? colors.primary : colors.textMuted}
            />
          )}
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
            {goal.title}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          {valueText}
          {linked ? ` · ${t('automático pelo hábito')}` : ''}
          {progress.achieved ? ` · ${t('meta atingida!')} 🎉` : ''}
        </AppText>
        <ProgressBar value={progress.ratio} label={`${goal.title}: ${valueText}`} height={8} />
      </Pressable>
      {!linked ? (
        <View style={styles.controls}>
          <IconButton
            icon="minus"
            label={t('Diminuir {name}', { name: goal.title })}
            onPress={() => change(-1)}
            disabled={goal.current <= 0}
          />
          <IconButton
            icon="plus"
            label={t('Aumentar {name}', { name: goal.title })}
            onPress={() => change(1)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  main: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  controls: { flexDirection: 'row' },
});
