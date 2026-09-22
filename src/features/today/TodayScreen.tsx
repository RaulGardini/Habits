import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { getDayPeriod } from '@/core/dates/dayPeriod';
import { isLocalDate, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { maxDate, minDate, periodRange } from '@/core/dates/periods';
import { computeDayProgress, groupByTimeOfDay, highlightedPeriod } from '@/core/habits/day';
import { periodQuota, type PeriodQuota } from '@/core/habits/quota';
import { habitsDueOn } from '@/core/habits/schedule';
import type { EntryInput, Habit, HabitEntry } from '@/core/habits/types';
import { TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL } from '@/features/habits/labels';
import { useStreaks } from '@/features/habits/useStreaks';
import { useNow } from '@/hooks/useNow';
import { hapticSuccess } from '@/lib/haptics';
import { useDayEntries, useEntriesInRange, useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { elapsedSeconds, useTimerStore } from '@/stores/timerStore';
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

import { Celebration } from './Celebration';
import { DayNavigator } from './DayNavigator';
import { HabitActionSheet, type HabitActionTarget } from './HabitActionSheet';
import { HabitBubble } from './HabitBubble';
import { TodayAgenda } from './TodayAgenda';

const GREETING = { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' } as const;

/** Target width of one habit cell; the circle stays small so a row fits 4–5 habits. */
const CELL_TARGET = 72;
const MAX_CIRCLE = 56;

/** A short, kind line above the day's progress. */
function encouragement(completed: number, total: number): string {
  if (total === 0) return 'Dia livre.';
  if (completed === total) return 'Tudo feito. Que dia bom!';
  if (completed === 0) return 'Um passo de cada vez.';
  if (completed * 2 === total) return 'Metade feita. Continue assim!';
  if (completed * 2 > total) return 'Mais da metade. Falta pouco!';
  return 'Bom começo!';
}

export function TodayScreen() {
  const activeTimer = useTimerStore((state) => state.active);
  // A running timer needs to tick every second; otherwise once a minute is enough.
  const now = useNow(activeTimer ? 1000 : 60_000);
  const today = todayLocal(now);
  const params = useLocalSearchParams<{ date?: string }>();
  // null = follow "today", so the screen rolls over at midnight.
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const date = selectedDate ?? today;
  const setDate = (next: LocalDate) => setSelectedDate(next === today ? null : next);
  const { colors } = useTheme();

  // Deep link: /?date=YYYY-MM-DD. Adjusted during render when the param changes (the tab stays
  // mounted, so an initial value alone is not enough).
  const [linkedDate, setLinkedDate] = useState<string | undefined>(undefined);
  if (params.date !== linkedDate) {
    setLinkedDate(params.date);
    if (params.date && isLocalDate(params.date)) setSelectedDate(params.date);
  }

  const habits = useHabitsStore((state) => state.habits);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const { entries } = useDayEntries(date);
  const save = useEntriesStore((state) => state.save);

  const due = useMemo(() => habitsDueOn(habits, date), [habits, date]);
  const quotas = usePeriodQuotas(due, date, entries, weekStartsOn);
  const streaks = useStreaks(due);
  const excluded = useMemo(
    () => new Set([...quotas].filter(([, quota]) => quota.met).map(([habitId]) => habitId)),
    [quotas],
  );
  const groups = useMemo(() => groupByTimeOfDay(due), [due]);
  const progress = computeDayProgress(due, entries, excluded);
  const currentPeriod = highlightedPeriod(date, today, getDayPeriod(now));
  const isFuture = date > today;
  const hasHabits = habits.some((h) => h.archivedAt === null);

  const [target, setTarget] = useState<HabitActionTarget | null>(null);
  const [width, setWidth] = useState(0);
  const columns = Math.max(3, Math.floor(width / CELL_TARGET) || 4);
  const cell = width > 0 ? width / columns : CELL_TARGET;
  const circle = Math.min(MAX_CIRCLE, cell - spacing.sm);
  const celebrating = useDayCompleted(date, progress.completed, progress.total);

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

  const timerInfo = (habit: Habit, entry: HabitEntry | undefined) => {
    if (habit.tracking.type !== 'timer') return { seconds: null, running: false };
    const running = activeTimer?.habitId === habit.id && activeTimer.date === date;
    return {
      seconds: running ? elapsedSeconds(activeTimer, now.getTime()) : (entry?.value ?? 0),
      running,
    };
  };

  return (
    <Screen>
      <DayNavigator
        date={date}
        today={today}
        onChange={setDate}
        greeting={GREETING[getDayPeriod(now)]}
      />

      {due.length > 0 ? (
        <Card style={{ backgroundColor: colors.primarySoft, boxShadow: 'none' }}>
          <View style={styles.progressHeader}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {encouragement(progress.completed, progress.total)}
            </AppText>
            <AppText variant="label" tone="muted">
              {progress.completed} de {progress.total}
            </AppText>
          </View>
          <ProgressBar
            value={progress.ratio}
            label={`${progress.completed} de ${progress.total} hábitos concluídos`}
          />
        </Card>
      ) : null}

      <View
        style={styles.groups}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      >
        {groups.map((group) => {
          const isCurrent = group.timeOfDay === currentPeriod;
          return (
            <View key={group.timeOfDay} style={styles.group}>
              <View style={styles.groupHeader} accessibilityRole="header">
                <Icon
                  name={TIME_OF_DAY_ICON[group.timeOfDay]}
                  size={18}
                  color={isCurrent ? colors.accent : colors.textMuted}
                />
                <AppText variant="label" tone={isCurrent ? colors.accent : 'muted'}>
                  {TIME_OF_DAY_LABEL[group.timeOfDay]}
                </AppText>
                {isCurrent ? (
                  <View style={[styles.nowBadge, { backgroundColor: colors.primarySoft }]}>
                    <AppText variant="caption" tone={colors.accent}>
                      agora
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.grid}>
                {group.habits.map((habit) => {
                  const entry = entries[habit.id];
                  const { seconds, running } = timerInfo(habit, entry);
                  return (
                    <HabitBubble
                      key={habit.id}
                      habit={habit}
                      entry={entry}
                      quota={quotas.get(habit.id) ?? null}
                      timerSeconds={seconds}
                      running={running}
                      disabled={isFuture}
                      size={circle}
                      width={cell}
                      onPress={() =>
                        setTarget({
                          habit,
                          entry,
                          quota: quotas.get(habit.id) ?? null,
                          streak: streaks.get(habit.id),
                          timerSeconds: seconds,
                          running,
                        })
                      }
                      onLongPress={() =>
                        router.push({ pathname: '/entry', params: { habitId: habit.id, date } })
                      }
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

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

      <TodayAgenda date={date} />

      <HabitActionSheet
        target={target}
        date={date}
        onClose={() => setTarget(null)}
        onSave={saveEntry}
        onTimerToggle={toggleTimer}
      />
      <Celebration visible={celebrating.visible} onDone={celebrating.dismiss} />
    </Screen>
  );
}

/** True right after the last habit of the day is completed (not when opening an already-done day). */
function useDayCompleted(date: LocalDate, completed: number, total: number) {
  const [visible, setVisible] = useState(false);
  const previous = useRef<{ date: LocalDate; done: boolean } | null>(null);

  useEffect(() => {
    const done = total > 0 && completed === total;
    const before = previous.current;
    previous.current = { date, done };
    if (before?.date === date && !before.done && done) {
      hapticSuccess();
      setVisible(true);
    }
  }, [date, completed, total]);

  return { visible, dismiss: () => setVisible(false) };
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
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: 0 },
  nowBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
});
