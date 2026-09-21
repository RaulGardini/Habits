import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDayLabel, type LocalDate } from '@/core/dates/localDate';
import { weekdayLong } from '@/core/dates/weekdays';
import { capitalize, formatDuration, formatNumber, formatPercent } from '@/core/format';
import { computeStreaks } from '@/core/habits/streaks';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { habitDailyScores, habitStats } from '@/core/stats/stats';
import { HabitIcon } from '@/features/habits/HabitIcon';
import {
  STATUS_LABEL,
  describeFrequency,
  describeStreak,
  describeTarget,
  describeValue,
} from '@/features/habits/labels';
import { useToday } from '@/hooks/useNow';
import { useHabitHistory } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';

import { Heatmap, HeatmapLegend } from './Heatmap';
import { PeriodHeader, formatRange, useStatsPeriod } from './PeriodHeader';
import { StatGrid, StatTile } from './StatTile';

export function HabitStatsScreen({ id }: { id: string }) {
  const habit = useHabitsStore((state) => state.habits.find((h) => h.id === id));
  const history = useHabitHistory(id);
  if (!habit) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title="Hábito não encontrado" />
      </Screen>
    );
  }
  return <HabitStats habit={habit} history={history ?? []} />;
}

/** Total recorded in the period, in the habit's unit. */
function describeTotal(habit: Habit, doneCount: number, totalValue: number): string {
  switch (habit.tracking.type) {
    case 'boolean':
      return `${doneCount} ${doneCount === 1 ? 'vez' : 'vezes'}`;
    case 'quantity':
      return `${formatNumber(totalValue)} ${habit.tracking.unit}`;
    case 'timer':
      return formatDuration(totalValue);
  }
}

function describeDay(
  habit: Habit,
  entry: HabitEntry | undefined,
  score: number | null | undefined,
) {
  if (score === null || score === undefined) {
    return entry?.status === 'skipped' ? STATUS_LABEL.skipped : 'não conta';
  }
  if (!entry) return STATUS_LABEL.missed;
  const value = entry.value ? ` · ${describeValue(habit.tracking, entry.value)}` : '';
  const note = entry.note ? ` · “${entry.note}”` : '';
  return `${STATUS_LABEL[entry.status]}${value}${note}`;
}

function HabitStats({ habit, history }: { habit: Habit; history: HabitEntry[] }) {
  const { scheme } = useTheme();
  const color = resolveHabitColor(habit.color, scheme);
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const period = useStatsPeriod('month');
  const [selected, setSelected] = useState<LocalDate | null>(null);

  const values = useMemo(
    () => habitDailyScores(habit, history, period.range, today),
    [habit, history, period.range, today],
  );
  const stats = habitStats(habit, history, period.range, today, weekStartsOn);
  const streaks = computeStreaks(habit, history, today, weekStartsOn);
  const selectedEntry = selected ? history.find((e) => e.date === selected) : undefined;
  const rangeLabel = formatRange(period.range, period.mode);
  const rate = stats.completionRate === null ? '—' : formatPercent(stats.completionRate);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Card style={styles.header}>
        <HabitIcon icon={habit.icon} color={habit.color} size={48} />
        <View style={styles.headerText}>
          <AppText variant="heading" numberOfLines={2}>
            {habit.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {[describeFrequency(habit.frequency, weekStartsOn), describeTarget(habit.tracking)]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </Card>

      <StatGrid>
        <StatTile
          label="Sequência atual"
          value={describeStreak(streaks.current, streaks.unit)}
          icon="fire"
          color={color.solid}
        />
        <StatTile
          label="Maior sequência"
          value={describeStreak(streaks.longest, streaks.unit)}
          icon="trophy-outline"
          color={color.solid}
        />
      </StatGrid>

      <PeriodHeader period={period} />

      <Card>
        <Heatmap
          mode={period.mode}
          range={period.range}
          values={values}
          color={color.solid}
          onColor={color.onSolid}
          weekStartsOn={weekStartsOn}
          today={today}
          selected={selected}
          onSelect={setSelected}
          accessibilityLabel={`Mapa de calor de ${habit.name} em ${rangeLabel}: ${rate} de conclusão.`}
        />
        <HeatmapLegend color={color.solid} />
        <AppText tone="muted" accessibilityLiveRegion="polite">
          {selected
            ? `${capitalize(formatDayLabel(selected, today))}: ${describeDay(habit, selectedEntry, values.get(selected))}`
            : 'Toque em um dia para ver os detalhes.'}
        </AppText>
      </Card>

      <StatGrid>
        <StatTile
          label="Taxa de conclusão"
          value={rate}
          icon="percent-outline"
          color={color.solid}
        />
        <StatTile
          label="Total no período"
          value={describeTotal(habit, stats.doneCount, stats.totalValue)}
          icon="sigma"
          color={color.solid}
        />
        <StatTile
          label="Melhor dia da semana"
          value={stats.bestWeekday === null ? '—' : capitalize(weekdayLong(stats.bestWeekday))}
          icon="calendar-star"
          color={color.solid}
        />
      </StatGrid>

      <Button
        variant="secondary"
        icon="pencil-outline"
        label="Editar hábito"
        onPress={() => router.push(`/habit/${habit.id}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
});
