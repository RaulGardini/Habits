import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getDayPeriod } from '@/core/dates/dayPeriod';
import { todayLocal, type LocalDate } from '@/core/dates/localDate';
import { computeDayProgress, groupByTimeOfDay, highlightedPeriod } from '@/core/habits/day';
import { habitsDueOn } from '@/core/habits/schedule';
import { TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL } from '@/features/habits/labels';
import { useNow } from '@/hooks/useNow';
import { selectDayEntries, useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';

import { DayNavigator } from './DayNavigator';
import { HabitCheckRow } from './HabitCheckRow';

export function TodayScreen() {
  const now = useNow();
  const today = todayLocal(now);
  // null = follow "today", so the screen rolls over at midnight.
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const date = selectedDate ?? today;
  const setDate = (next: LocalDate) => setSelectedDate(next === today ? null : next);
  const { colors } = useTheme();

  const habits = useHabitsStore((state) => state.habits);
  const hasHabits = habits.some((h) => h.archivedAt === null);
  const entries = useEntriesStore(selectDayEntries(date));
  const loadDate = useEntriesStore((state) => state.loadDate);
  const toggle = useEntriesStore((state) => state.toggle);

  useEffect(() => {
    loadDate(date).catch((error: unknown) =>
      showError('Não foi possível carregar os registros do dia.', error),
    );
  }, [date, loadDate]);

  const due = useMemo(() => habitsDueOn(habits, date), [habits, date]);
  const groups = useMemo(() => groupByTimeOfDay(due), [due]);
  const progress = computeDayProgress(due, entries);
  const currentPeriod = highlightedPeriod(date, today, getDayPeriod(now));
  const isFuture = date > today;

  const handleToggle = (habitId: string) =>
    toggle(habitId, date).catch((error: unknown) =>
      showError('Não foi possível salvar o registro.', error),
    );

  return (
    <Screen>
      <DayNavigator date={date} today={today} onChange={setDate} />

      {due.length > 0 ? (
        <Card>
          <View style={styles.progressHeader}>
            <AppText variant="bodyStrong">Progresso do dia</AppText>
            <AppText tone="muted">
              {progress.completed} de {progress.total}
            </AppText>
          </View>
          <ProgressBar
            value={progress.ratio}
            label={`${progress.completed} de ${progress.total} hábitos concluídos`}
          />
        </Card>
      ) : null}

      {groups.map((group) => {
        const isCurrent = group.timeOfDay === currentPeriod;
        return (
          <View
            key={group.timeOfDay}
            style={[
              styles.group,
              isCurrent && { borderColor: colors.primary, backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.groupHeader} accessibilityRole="header">
              <Icon
                name={TIME_OF_DAY_ICON[group.timeOfDay]}
                size={20}
                color={isCurrent ? colors.primary : colors.textMuted}
              />
              <AppText variant="label" tone={isCurrent ? colors.primary : 'muted'}>
                {TIME_OF_DAY_LABEL[group.timeOfDay].toUpperCase()}
              </AppText>
              {isCurrent ? (
                <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                  <AppText variant="caption" tone={colors.onPrimary}>
                    Agora
                  </AppText>
                </View>
              ) : null}
            </View>
            {group.habits.map((habit) => (
              <HabitCheckRow
                key={habit.id}
                habit={habit}
                done={entries[habit.id]?.status === 'done'}
                disabled={isFuture}
                onToggle={() => handleToggle(habit.id)}
              />
            ))}
          </View>
        );
      })}

      {due.length === 0 ? (
        <EmptyState
          icon={hasHabits ? 'calendar-blank-outline' : 'sprout-outline'}
          title={hasHabits ? 'Nada para este dia' : 'Comece seu primeiro hábito'}
          description={
            hasHabits
              ? 'Nenhum hábito está programado para esta data.'
              : 'Crie um hábito e marque aqui todos os dias.'
          }
          action={
            hasHabits ? null : (
              <Button label="Criar hábito" icon="plus" onPress={() => router.push('/habit/new')} />
            )
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  group: {
    gap: spacing.sm,
    padding: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  nowBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
});
