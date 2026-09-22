import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getDayPeriod } from '@/core/dates/dayPeriod';
import { isLocalDate, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { maxDate, minDate, periodRange } from '@/core/dates/periods';
import { computeDayProgress, groupByTimeOfDay, highlightedPeriod } from '@/core/habits/day';
import { incrementEntry, toggleEntry } from '@/core/habits/entries';
import { periodQuota, type PeriodQuota } from '@/core/habits/quota';
import { habitsDueOn } from '@/core/habits/schedule';
import type { EntryInput, Habit, HabitEntry } from '@/core/habits/types';
import { TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL } from '@/features/habits/labels';
import { useNow } from '@/hooks/useNow';
import { useDayEntries, useEntriesInRange, useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimerStore } from '@/stores/timerStore';
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
import { HabitDayRow } from './HabitDayRow';

export function TodayScreen() {
  const now = useNow();
  const today = todayLocal(now);
  const params = useLocalSearchParams<{ date?: string }>();
  // null = follow "today", so the screen rolls over at midnight.
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const date = selectedDate ?? today;
  const setDate = (next: LocalDate) => setSelectedDate(next === today ? null : next);
  const { colors } = useTheme();

  // Deep link from the planner: /?date=YYYY-MM-DD. Adjusted during render when the param
  // changes (the tab stays mounted, so an initial value alone is not enough).
  const [linkedDate, setLinkedDate] = useState<string | undefined>(undefined);
  if (params.date !== linkedDate) {
    setLinkedDate(params.date);
    if (params.date && isLocalDate(params.date)) setSelectedDate(params.date);
  }

  const habits = useHabitsStore((state) => state.habits);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const activeTimer = useTimerStore((state) => state.active);
  const { entries } = useDayEntries(date);
  const save = useEntriesStore((state) => state.save);

  const due = useMemo(() => habitsDueOn(habits, date), [habits, date]);
  const quotas = usePeriodQuotas(due, date, entries, weekStartsOn);
  const excluded = useMemo(
    () => new Set([...quotas].filter(([, quota]) => quota.met).map(([habitId]) => habitId)),
    [quotas],
  );
  const groups = useMemo(() => groupByTimeOfDay(due), [due]);
  const progress = computeDayProgress(due, entries, excluded);
  const currentPeriod = highlightedPeriod(date, today, getDayPeriod(now));
  const isFuture = date > today;
  const hasHabits = habits.some((h) => h.archivedAt === null);

  const saveEntry = (habit: Habit, next: EntryInput | null) =>
    save(habit.id, date, next).catch((error: unknown) =>
      showError('Não foi possível salvar o registro.', error),
    );

  const toggleTimer = (habit: Habit) => {
    const timers = useTimerStore.getState();
    const running = activeTimer?.habitId === habit.id && activeTimer.date === date;
    (running ? timers.stop() : timers.start(habit, date)).catch((error: unknown) =>
      showError('Não foi possível salvar o timer.', error),
    );
  };

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
              <HabitDayRow
                key={habit.id}
                habit={habit}
                date={date}
                entry={entries[habit.id]}
                disabled={isFuture}
                quota={quotas.get(habit.id) ?? null}
                activeTimer={activeTimer}
                onToggle={() => saveEntry(habit, toggleEntry(entries[habit.id]))}
                onIncrement={(direction) =>
                  saveEntry(habit, incrementEntry(habit, entries[habit.id], direction))
                }
                onTimerToggle={() => toggleTimer(habit)}
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

/**
 * Weekly/monthly quota of each flexible habit due on `date`. Other days come from the database;
 * the viewed day uses the (optimistic) in-memory entries so the quota updates instantly.
 */
function usePeriodQuotas(
  due: readonly Habit[],
  date: LocalDate,
  dayEntries: Readonly<Record<string, HabitEntry | undefined>>,
  weekStartsOn: 0 | 1,
): Map<string, PeriodQuota> {
  const week = periodRange(date, 'week', weekStartsOn);
  const month = periodRange(date, 'month', weekStartsOn);
  const rangeEntries = useEntriesInRange(
    minDate(week.from, month.from),
    maxDate(week.to, month.to),
  );

  return useMemo(() => {
    const merged = [
      ...(rangeEntries ?? []).filter((e) => e.date !== date),
      ...Object.values(dayEntries).filter((e): e is HabitEntry => e !== undefined),
    ];
    const quotas = new Map<string, PeriodQuota>();
    for (const habit of due) {
      const quota = periodQuota(habit, date, merged, weekStartsOn);
      if (quota) quotas.set(habit.id, quota);
    }
    return quotas;
  }, [due, date, dayEntries, rangeEntries, weekStartsOn]);
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
