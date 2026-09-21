import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { computeStreaks, type Streaks } from '@/core/habits/streaks';
import type { Habit, WeekStartsOn } from '@/core/habits/types';
import type { MoveDirection } from '@/core/utils/reorder';
import { useToday } from '@/hooks/useNow';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
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

export function HabitsScreen() {
  const habits = useHabitsStore((state) => state.habits);
  const move = useHabitsStore((state) => state.move);
  const setArchived = useHabitsStore((state) => state.setArchived);
  const [showArchived, setShowArchived] = useState(false);
  const { colors } = useTheme();

  const active = habits.filter((h) => h.archivedAt === null);
  const archived = habits.filter((h) => h.archivedAt !== null);

  const streaks = useStreaks(habits);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);

  const handleMove = (id: string, direction: MoveDirection) =>
    move(id, direction).catch((error: unknown) => showError('Não foi possível reordenar.', error));

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Hábitos
        </AppText>
        <Button label="Novo" icon="plus" onPress={() => router.push('/habit/new')} />
      </View>

      {active.length === 0 ? (
        <EmptyState
          icon="sprout-outline"
          title="Nenhum hábito ainda"
          description="Crie seu primeiro hábito para começar a acompanhar."
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
                label={`Mover ${habit.name} para cima`}
                onPress={() => handleMove(habit.id, 'up')}
                disabled={index === 0}
              />
              <IconButton
                icon="chevron-down"
                label={`Mover ${habit.name} para baixo`}
                onPress={() => handleMove(habit.id, 'down')}
                disabled={index === active.length - 1}
              />
            </HabitListRow>
          ))}
        </Card>
      )}

      {archived.length > 0 ? (
        <View style={styles.archived}>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={styles.archivedToggle}
          >
            <AppText variant="bodyStrong" tone="muted">
              Arquivados ({archived.length})
            </AppText>
            <Icon name={showArchived ? 'chevron-up' : 'chevron-down'} color={colors.textMuted} />
          </Pressable>
          {showArchived ? (
            <Card style={styles.list}>
              {archived.map((habit) => (
                <HabitListRow key={habit.id} habit={habit} weekStartsOn={weekStartsOn}>
                  <IconButton
                    icon="archive-arrow-up-outline"
                    label={`Desarquivar ${habit.name}`}
                    onPress={() =>
                      setArchived(habit.id, false).catch((error: unknown) =>
                        showError('Não foi possível desarquivar.', error),
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

/** Current streak of every habit (full history loaded once, refreshed on changes). */
function useStreaks(habits: readonly Habit[]): Map<string, Streaks> {
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const earliest = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), today);
  const entries = useEntriesInRange(earliest, today);
  return useMemo(() => {
    const map = new Map<string, Streaks>();
    if (!entries) return map;
    for (const habit of habits) {
      const own = entries.filter((e) => e.habitId === habit.id);
      map.set(habit.id, computeStreaks(habit, own, today, weekStartsOn));
    }
    return map;
  }, [habits, entries, today, weekStartsOn]);
}

interface HabitListRowProps {
  habit: Habit;
  streak?: Streaks;
  weekStartsOn: WeekStartsOn;
  children: React.ReactNode;
}

function HabitListRow({ habit, streak, weekStartsOn, children }: HabitListRowProps) {
  const details = [
    TIME_OF_DAY_LABEL[habit.timeOfDay],
    describeFrequency(habit.frequency, weekStartsOn),
    describeTarget(habit.tracking),
    streak && streak.current > 0 ? `🔥 ${describeStreak(streak.current, streak.unit)}` : null,
  ].filter(Boolean);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/habit/${habit.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${habit.name}`}
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
