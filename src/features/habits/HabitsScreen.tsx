import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Streaks } from '@/core/habits/streaks';
import type { Habit, WeekStartsOn } from '@/core/habits/types';
import type { MoveDirection } from '@/core/utils/reorder';
import { useHabitsStore } from '@/stores/habitsStore';
import { goalPeriodOf } from '@/core/planner/planner';
import { GoalsSection } from '@/features/goals/GoalsSection';
import { useToday } from '@/hooks/useNow';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';

import { HabitIcon } from './HabitIcon';
import { TIME_OF_DAY_LABEL, describeFrequency, describeStreak, describeTarget } from './labels';
import { useStreaks } from './useStreaks';
import { t } from '@/i18n/i18n';

export function HabitsScreen() {
  const habits = useHabitsStore((state) => state.habits);
  const move = useHabitsStore((state) => state.move);
  const setArchived = useHabitsStore((state) => state.setArchived);
  const [showArchived, setShowArchived] = useState(false);
  const { colors } = useTheme();

  const active = habits.filter((h) => h.archivedAt === null);
  const archived = habits.filter((h) => h.archivedAt !== null);

  const today = useToday();
  const streaks = useStreaks(habits);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);

  const handleMove = (id: string, direction: MoveDirection) =>
    move(id, direction).catch((error: unknown) =>
      showError(t('Não foi possível reordenar.'), error),
    );

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {t('Hábitos')}
        </AppText>
        <Button label={t('Novo')} icon="plus" onPress={() => router.push('/habit/new')} />
      </View>

      {active.length === 0 ? (
        <EmptyState
          icon="sprout-outline"
          title={t('Nenhum hábito ainda')}
          description={t('Crie seu primeiro hábito para começar a acompanhar.')}
        />
      ) : (
        <Card style={styles.list}>
          {active.map((habit, index) => (
            <HabitListRow
              key={habit.id}
              habit={habit}
              streak={streaks.get(habit.id)}
              weekStartsOn={weekStartsOn}
            >
              <IconButton
                icon="chevron-up"
                label={t('Mover {name} para cima', { name: habit.name })}
                onPress={() => handleMove(habit.id, 'up')}
                disabled={index === 0}
              />
              <IconButton
                icon="chevron-down"
                label={t('Mover {name} para baixo', { name: habit.name })}
                onPress={() => handleMove(habit.id, 'down')}
                disabled={index === active.length - 1}
              />
            </HabitListRow>
          ))}
        </Card>
      )}

      <View style={styles.goals}>
        <AppText variant="heading" accessibilityRole="header">
          {t('Metas do mês')}
        </AppText>
        <GoalsSection scope="month" period={goalPeriodOf(today, 'month')} />
        <AppText variant="heading" accessibilityRole="header">
          {t('Metas do ano')}
        </AppText>
        <GoalsSection scope="year" period={goalPeriodOf(today, 'year')} />
      </View>

      {archived.length > 0 ? (
        <View style={styles.archived}>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={styles.archivedToggle}
          >
            <AppText variant="bodyStrong" tone="muted">
              {t('Arquivados ({count})', { count: archived.length })}
            </AppText>
            <Icon name={showArchived ? 'chevron-up' : 'chevron-down'} color={colors.textMuted} />
          </Pressable>
          {showArchived ? (
            <Card style={styles.list}>
              {archived.map((habit) => (
                <HabitListRow key={habit.id} habit={habit} weekStartsOn={weekStartsOn}>
                  <IconButton
                    icon="archive-arrow-up-outline"
                    label={t('Desarquivar {name}', { name: habit.name })}
                    onPress={() =>
                      setArchived(habit.id, false).catch((error: unknown) =>
                        showError(t('Não foi possível desarquivar.'), error),
                      )
                    }
                  />
                </HabitListRow>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

interface HabitListRowProps {
  habit: Habit;
  streak?: Streaks;
  weekStartsOn: WeekStartsOn;
  children: React.ReactNode;
}

function HabitListRow({ habit, streak, weekStartsOn, children }: HabitListRowProps) {
  const details = [
    t(TIME_OF_DAY_LABEL[habit.timeOfDay]),
    describeFrequency(habit.frequency, weekStartsOn),
    describeTarget(habit.tracking),
    streak && streak.current > 0 ? `🔥 ${describeStreak(streak.current, streak.unit)}` : null,
  ].filter(Boolean);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/habit/${habit.id}`)}
        accessibilityRole="button"
        accessibilityLabel={t('Editar {name}', { name: habit.name })}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
      >
        <HabitIcon icon={habit.icon} color={habit.color} />
        <View style={styles.rowText}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {habit.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {details.join(' · ')}
          </AppText>
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  goals: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { padding: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  rowText: { flex: 1 },
  archived: { gap: spacing.sm },
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_SIZE,
  },
});
