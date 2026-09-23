import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { getDayPeriod } from '@/core/dates/dayPeriod';
import { isLocalDate, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { maxDate, minDate, periodRange } from '@/core/dates/periods';
import { computeDayProgress, groupByTimeOfDay, highlightedPeriod } from '@/core/habits/day';
import { periodQuota, type PeriodQuota } from '@/core/habits/quota';
import { habitsDueOn } from '@/core/habits/schedule';
import type { Streaks } from '@/core/habits/streaks';
import type { EntryInput, Habit, HabitEntry } from '@/core/habits/types';
import { describeStreak, TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL } from '@/features/habits/labels';
import { useStreaks } from '@/features/habits/useStreaks';
import { useNow } from '@/hooks/useNow';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
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
import { Flame } from '@/ui/Flame';
import { Screen } from '@/ui/Screen';

import { Celebration, type CelebrationContent } from './Celebration';
import { DayNavigator } from './DayNavigator';
import { HabitActionSheet, type HabitActionTarget } from './HabitActionSheet';
import { HabitBubble } from './HabitBubble';
import { StreakSheet } from './StreakSheet';
import { usePerfectStreak } from './usePerfectStreak';
import { TodayAgenda } from './TodayAgenda';
import { t } from '@/i18n/i18n';

function greeting(period: 'morning' | 'afternoon' | 'evening'): string {
  return t({ morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' }[period]);
}

/** Streak lengths worth a small celebration. */
const MILESTONES = [7, 30, 100, 365];

function milestoneMessage(count: number, unit: Streaks['unit']): string {
  if (unit === 'day' && count === 7) return `${t('1 semana seguida!')} 🔥`;
  if (unit === 'day' && count === 30) return `${t('30 dias seguidos!')} 🔥`;
  if (unit === 'day' && count === 365) return `${t('1 ano seguido!')} 🏆`;
  return `${t('{streak} seguidos!', { streak: describeStreak(count, unit) })} 🔥`;
}

/** Habits per row (more only on wide screens), and the circle size cap. */
const COLUMNS = 5;
const WIDE_CELL = 110;
const MAX_CIRCLE = 56;

/** A short, kind line above the day's progress. */
function encouragement(completed: number, total: number): string {
  if (total === 0) return t('Dia livre.');
  if (completed === total) return t('Tudo feito. Que dia bom!');
  if (completed === 0) return t('Um passo de cada vez.');
  if (completed * 2 === total) return t('Metade feita. Continue assim!');
  if (completed * 2 > total) return t('Mais da metade. Falta pouco!');
  return t('Bom começo!');
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
  const displayName = useSettingsStore((state) => state.displayName);
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
  const [streakOpen, setStreakOpen] = useState(false);
  const streak = usePerfectStreak(today);
  const [width, setWidth] = useState(0);
  const columns = Math.max(COLUMNS, Math.floor(width / WIDE_CELL));
  const cell = width > 0 ? width / columns : WIDE_CELL;
  const circle = Math.min(MAX_CIRCLE, cell - spacing.sm);
  const [celebration, setCelebration] = useState<CelebrationContent | null>(null);
  useDayCompleted(date, progress.completed, progress.total, setCelebration);
  useStreakMilestones(date, today, streaks, setCelebration);

  const saveEntry = (habit: Habit, next: EntryInput | null, day: LocalDate) =>
    save(habit.id, day, next).catch((error: unknown) =>
      showError(t('Não foi possível salvar o registro.'), error),
    );

  const toggleTimer = (habit: Habit, day: LocalDate) => {
    const timers = useTimerStore.getState();
    const running = activeTimer?.habitId === habit.id && activeTimer.date === day;
    (running ? timers.stop() : timers.start(habit, day)).catch((error: unknown) =>
      showError(t('Não foi possível salvar o timer.'), error),
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
        greeting={
          displayName
            ? t('{greeting}, {name}', { greeting: greeting(getDayPeriod(now)), name: displayName })
            : greeting(getDayPeriod(now))
        }
      />

      {due.length > 0 ? (
        <Card style={[styles.progressCard, { backgroundColor: colors.primarySoft }]}>
          <View style={styles.progressRow}>
            <View style={styles.flex}>
              <View style={styles.progressHeader}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {encouragement(progress.completed, progress.total)}
                </AppText>
                <AppText variant="label" tone="muted">
                  {progress.completed} de {progress.total}
                </AppText>
              </View>
              <ProgressBar
                height={8}
                value={progress.ratio}
                label={t('{completed} de {total} hábitos concluídos', {
                  completed: progress.completed,
                  total: progress.total,
                })}
              />
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                setStreakOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t(
                'Sequência de {count} dias perfeitos. Ver a trilha das chamas.',
                { count: streak.current },
              )}
              style={({ pressed }) => [styles.streak, pressed && styles.pressed]}
            >
              <Flame days={streak.current} size={32} dimmed={streak.current === 0} />
              <AppText variant="label">{streak.current}</AppText>
            </Pressable>
          </View>
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
                  {t(TIME_OF_DAY_LABEL[group.timeOfDay])}
                </AppText>
                {isCurrent ? (
                  <View style={[styles.nowBadge, { backgroundColor: colors.primarySoft }]}>
                    <AppText variant="caption" tone={colors.accent}>
                      {t('agora')}
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
                      onPress={() => {
                        hapticSelection();
                        setTarget({
                          habit,
                          date,
                          entry,
                          quota: quotas.get(habit.id) ?? null,
                          streak: streaks.get(habit.id),
                          timerSeconds: seconds,
                          running,
                        });
                      }}
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
          title={hasHabits ? t('Nada para este dia') : t('Comece seu primeiro hábito')}
          description={
            hasHabits
              ? t('Nenhum hábito está programado para esta data.')
              : t('Crie um hábito e marque aqui todos os dias.')
          }
          action={
            hasHabits ? null : (
              <Button
                label={t('Criar hábito')}
                icon="plus"
                onPress={() => router.push('/habit/new')}
              />
            )
          }
        />
      ) : null}

      <TodayAgenda date={date} />

      <HabitActionSheet
        target={target}
        date={target?.date ?? date}
        onClose={() => setTarget(null)}
        // The sheet's day, not the screen's: at midnight the screen may already show the next day.
        onSave={(habit, next) => saveEntry(habit, next, target?.date ?? date)}
        onTimerToggle={(habit) => toggleTimer(habit, target?.date ?? date)}
      />
      <StreakSheet streak={streak} visible={streakOpen} onClose={() => setStreakOpen(false)} />
      <Celebration content={celebration} onDone={() => setCelebration(null)} />
    </Screen>
  );
}

/** Celebrates right after the last habit of the day is completed (not on opening a done day). */
function useDayCompleted(
  date: LocalDate,
  completed: number,
  total: number,
  celebrate: (content: CelebrationContent) => void,
) {
  const previous = useRef<{ date: LocalDate; done: boolean } | null>(null);

  useEffect(() => {
    const done = total > 0 && completed === total;
    const before = previous.current;
    previous.current = { date, done };
    if (before?.date === date && !before.done && done) {
      hapticSuccess();
      celebrate({ message: `${t('Tudo feito hoje!')} 🎉`, pieces: 28 });
    }
  }, [date, completed, total, celebrate]);
}

/** Celebrates when a streak reaches 7, 30, 100 or 365 while the user is on today. */
function useStreakMilestones(
  date: LocalDate,
  today: LocalDate,
  streaks: ReadonlyMap<string, Streaks>,
  celebrate: (content: CelebrationContent) => void,
) {
  const previous = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const current = new Map([...streaks].map(([id, streak]) => [id, streak.current]));
    const before = previous.current;
    previous.current = current;
    if (!before || date !== today) return;
    for (const [id, count] of current) {
      const was = before.get(id);
      if (was === undefined || count <= was || !MILESTONES.includes(count)) continue;
      hapticSuccess();
      celebrate({ message: milestoneMessage(count, streaks.get(id)?.unit ?? 'day'), pieces: 14 });
      return;
    }
  }, [date, today, streaks, celebrate]);
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
  // A shorter card: the day's progress should not dominate the screen.
  progressCard: { boxShadow: 'none', paddingVertical: spacing.md, gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streak: { alignItems: 'center', minWidth: 44, gap: 0 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  groups: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: 0 },
  nowBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
});
