import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { parseLocalDate, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { periodRange, shiftPeriod } from '@/core/dates/periods';
import { capitalize } from '@/core/format';
import { goalPeriodOf, overdueTasks, summarizeDays } from '@/core/planner/planner';
import { overallDailyScores } from '@/core/stats/stats';
import { Heatmap } from '@/features/stats/Heatmap';
import { DayNavigator } from '@/features/today/DayNavigator';
import { useNow } from '@/hooks/useNow';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { plannerActions, useEvents, useOverdueTasks, useTasks } from '@/stores/plannerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { showError } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';

import { DayNoteEditor } from './DayNoteEditor';
import { EventTimeline } from './EventTimeline';
import { GoalsSection } from './GoalsSection';
import { HabitsSummary } from './HabitsSummary';
import { MonthCalendar } from './MonthCalendar';
import { TaskList } from './TaskList';

type PlannerMode = 'day' | 'month' | 'year';

const MODE_OPTIONS = [
  { value: 'day', label: 'Dia', icon: 'calendar-today' },
  { value: 'month', label: 'Mês', icon: 'calendar-month-outline' },
  { value: 'year', label: 'Ano', icon: 'calendar-blank-multiple' },
] as const;

export function PlannerScreen() {
  const now = useNow();
  const today = todayLocal(now);
  const [mode, setMode] = useState<PlannerMode>('day');
  // null = follow today.
  const [selected, setSelected] = useState<LocalDate | null>(null);
  const date = selected ?? today;
  const setDate = (next: LocalDate) => setSelected(next === today ? null : next);

  const openDay = (next: LocalDate) => {
    setDate(next);
    setMode('day');
  };
  const openMonth = (next: LocalDate) => {
    setDate(next);
    setMode('month');
  };

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Planner
      </AppText>
      <SegmentedControl<PlannerMode>
        label="Visão"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />
      {mode === 'day' ? (
        <DayPlanner date={date} today={today} now={now} onChangeDate={setDate} />
      ) : mode === 'month' ? (
        <MonthPlanner date={date} today={today} onChangeDate={setDate} onOpenDay={openDay} />
      ) : (
        <YearPlanner
          date={date}
          today={today}
          onChangeDate={setDate}
          onOpenMonth={openMonth}
          onOpenDay={openDay}
        />
      )}
    </Screen>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.sectionHeader} accessibilityRole="header">
        <Icon name={icon} size={20} color={colors.primary} />
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </Card>
  );
}

function DayPlanner({
  date,
  today,
  now,
  onChangeDate,
}: {
  date: LocalDate;
  today: LocalDate;
  now: Date;
  onChangeDate: (date: LocalDate) => void;
}) {
  const { colors } = useTheme();
  const tasks = useTasks(date, date);
  const events = useEvents(date, date);
  const overdue = useOverdueTasks(today);
  const pendingOverdue = date === today ? overdueTasks(overdue ?? [], today) : [];

  const bringOverdue = () =>
    plannerActions
      .moveTasks(
        pendingOverdue.map((t) => t.id),
        today,
      )
      .catch((error: unknown) => showError('Não foi possível mover as tarefas.', error));

  return (
    <>
      <DayNavigator date={date} today={today} onChange={onChangeDate} />

      {pendingOverdue.length > 0 ? (
        <View
          style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <Icon name="calendar-alert" color={colors.primary} />
          <AppText style={styles.flex}>
            {pendingOverdue.length} tarefa{pendingOverdue.length === 1 ? '' : 's'} pendente
            {pendingOverdue.length === 1 ? '' : 's'} de dias anteriores
          </AppText>
          <Button variant="secondary" label="Trazer para hoje" onPress={bringOverdue} />
        </View>
      ) : null}

      <Section title="Hábitos" icon="checkbox-marked-circle-outline">
        <HabitsSummary date={date} />
      </Section>
      <Section title="Tarefas" icon="format-list-checks">
        {tasks ? <TaskList date={date} tasks={tasks} /> : null}
      </Section>
      <Section title="Agenda" icon="clock-outline">
        {events ? (
          <EventTimeline
            date={date}
            events={events}
            nowMinutes={date === today ? now.getHours() * 60 + now.getMinutes() : null}
          />
        ) : null}
      </Section>
      <Section title="Diário" icon="notebook-outline">
        <DayNoteEditor date={date} />
      </Section>
    </>
  );
}

function PeriodNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.periodNav}>
      <IconButton icon="chevron-left" label="Anterior" onPress={onPrev} />
      <AppText variant="heading" style={styles.periodLabel} accessibilityLiveRegion="polite">
        {label}
      </AppText>
      <IconButton icon="chevron-right" label="Próximo" onPress={onNext} />
    </View>
  );
}

function MonthPlanner({
  date,
  today,
  onChangeDate,
  onOpenDay,
}: {
  date: LocalDate;
  today: LocalDate;
  onChangeDate: (date: LocalDate) => void;
  onOpenDay: (date: LocalDate) => void;
}) {
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const habits = useHabitsStore((state) => state.habits);
  const { from, to } = periodRange(date, 'month', weekStartsOn);
  const tasks = useTasks(from, to);
  const events = useEvents(from, to);
  const entries = useEntriesInRange(from, to);

  const habitScores = useMemo(
    () => overallDailyScores(habits, entries ?? [], { from, to }, today),
    [habits, entries, from, to, today],
  );
  const plans = useMemo(() => summarizeDays(tasks ?? [], events ?? []), [tasks, events]);
  const label = capitalize(format(parseLocalDate(date), "MMMM 'de' yyyy", { locale: ptBR }));

  return (
    <>
      <PeriodNav
        label={label}
        onPrev={() => onChangeDate(shiftPeriod(date, 'month', -1))}
        onNext={() => onChangeDate(shiftPeriod(date, 'month', 1))}
      />
      <Card>
        <MonthCalendar
          range={{ from, to }}
          today={today}
          weekStartsOn={weekStartsOn}
          habitScores={habitScores}
          plans={plans}
          onSelect={onOpenDay}
        />
      </Card>
      <Section title="Metas do mês" icon="flag-checkered">
        <GoalsSection scope="month" period={goalPeriodOf(date, 'month')} />
      </Section>
    </>
  );
}

function YearPlanner({
  date,
  today,
  onChangeDate,
  onOpenMonth,
  onOpenDay,
}: {
  date: LocalDate;
  today: LocalDate;
  onChangeDate: (date: LocalDate) => void;
  onOpenMonth: (date: LocalDate) => void;
  onOpenDay: (date: LocalDate) => void;
}) {
  const { colors } = useTheme();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const habits = useHabitsStore((state) => state.habits);
  const { from, to } = periodRange(date, 'year', weekStartsOn);
  const entries = useEntriesInRange(from, to);
  const scores = useMemo(
    () => overallDailyScores(habits, entries ?? [], { from, to }, today),
    [habits, entries, from, to, today],
  );
  const values = useMemo(
    () => new Map([...scores].map(([day, score]) => [day, score?.ratio ?? null])),
    [scores],
  );
  const months = Array.from(
    { length: 12 },
    (_, i) => `${from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`,
  );

  return (
    <>
      <PeriodNav
        label={from.slice(0, 4)}
        onPrev={() => onChangeDate(shiftPeriod(date, 'year', -1))}
        onNext={() => onChangeDate(shiftPeriod(date, 'year', 1))}
      />
      <Section title="Metas do ano" icon="trophy-outline">
        <GoalsSection scope="year" period={goalPeriodOf(date, 'year')} />
      </Section>
      <View style={styles.months}>
        {months.map((first) => {
          const range = periodRange(first, 'month', weekStartsOn);
          const name = capitalize(format(parseLocalDate(first), 'MMMM', { locale: ptBR }));
          return (
            <View
              key={first}
              style={[
                styles.monthCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Pressable
                onPress={() => onOpenMonth(first)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${name}`}
                style={styles.monthTitle}
              >
                <AppText variant="bodyStrong">{name}</AppText>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
              <Heatmap
                mode="month"
                range={range}
                values={values}
                color={colors.primary}
                onColor={colors.onPrimary}
                weekStartsOn={weekStartsOn}
                today={today}
                selected={null}
                onSelect={onOpenDay}
                accessibilityLabel={`Hábitos em ${name}`}
              />
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  flex: { flex: 1, minWidth: 160 },
  periodNav: { flexDirection: 'row', alignItems: 'center' },
  periodLabel: { flex: 1, textAlign: 'center' },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  monthCard: {
    flexGrow: 1,
    flexBasis: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  monthTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
});
