import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/core/dates/localDate';
import { computeDayProgress } from '@/core/habits/day';
import { entryProgress } from '@/core/habits/entries';
import { habitsDueOn } from '@/core/habits/schedule';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { useDayEntries } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { ProgressBar } from '@/ui/ProgressBar';

/** Compact habits overview of a day, linking to the Today screen for that date. */
export function HabitsSummary({ date }: { date: LocalDate }) {
  const { scheme } = useTheme();
  const habits = useHabitsStore((state) => state.habits);
  const { entries } = useDayEntries(date);

  const due = useMemo(() => habitsDueOn(habits, date), [habits, date]);
  const progress = computeDayProgress(due, entries);

  if (due.length === 0) {
    return <AppText tone="muted">Nenhum hábito programado para este dia.</AppText>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText tone="muted">
          {progress.completed} de {progress.total} concluídos
        </AppText>
      </View>
      <ProgressBar
        value={progress.ratio}
        label={`${progress.completed} de ${progress.total} hábitos concluídos`}
      />
      <View style={styles.icons}>
        {due.map((habit) => {
          const done = entries[habit.id]?.status === 'done';
          const partial = !done && entryProgress(habit, entries[habit.id]) > 0;
          const color = resolveHabitColor(habit.color, scheme);
          return (
            <View
              key={habit.id}
              style={[styles.iconWrap, !done && !partial && styles.faded]}
              accessible
              accessibilityLabel={`${habit.name}: ${done ? 'concluído' : partial ? 'parcial' : 'pendente'}`}
            >
              <HabitIcon icon={habit.icon} color={habit.color} size={32} />
              {done ? (
                <View style={[styles.badge, { backgroundColor: color.solid }]}>
                  <Icon name="check-bold" size={10} color={color.onSolid} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Button
        variant="ghost"
        icon="checkbox-marked-circle-outline"
        label="Registrar hábitos deste dia"
        onPress={() => router.navigate({ pathname: '/', params: { date } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconWrap: { position: 'relative' },
  faded: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
