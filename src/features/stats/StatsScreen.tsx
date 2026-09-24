import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDayLabel, type LocalDate } from '@/core/dates/localDate';
import { capitalize, formatPercent } from '@/core/format';
import { habitStats, overallDailyScores, summarizeScores } from '@/core/stats/stats';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { describeStreak } from '@/features/habits/labels';
import { useStreaks } from '@/features/habits/useStreaks';
import { useToday } from '@/hooks/useNow';
import { useEntriesInRange } from '@/stores/entriesStore';
import { useActiveHabits, useHabitsStore } from '@/stores/habitsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';

import { Heatmap, HeatmapLegend } from './Heatmap';
import { PeriodHeader, formatRange, useStatsPeriod } from './PeriodHeader';
import { t } from '@/i18n/i18n';

export function StatsScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const habits = useHabitsStore((state) => state.habits);
  const active = useActiveHabits();
  const period = useStatsPeriod('month');
  const entries = useEntriesInRange(period.range.from, period.range.to);
  const streaks = useStreaks(active);
  const [selected, setSelected] = useState<LocalDate | null>(null);

  const scores = useMemo(
    () => overallDailyScores(habits, entries ?? [], period.range, today, weekStartsOn),
    [habits, entries, period.range, today, weekStartsOn],
  );
  const values = useMemo(
    () => new Map([...scores].map(([date, score]) => [date, score?.ratio ?? null])),
    [scores],
  );
  const summary = summarizeScores(scores);
  const selectedScore = selected ? scores.get(selected) : undefined;
  const rangeLabel = formatRange(period.range, period.mode);

  if (habits.length === 0) {
    return (
      <Screen>
        <AppText variant="title" accessibilityRole="header">
          {t('Estatísticas')}
        </AppText>
        <EmptyState
          icon="chart-box-outline"
          title={t('Sem dados ainda')}
          description={t('Crie hábitos e registre seus dias para ver o progresso aqui.')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        {t('Estatísticas')}
      </AppText>
      <PeriodHeader period={period} />

      <Card>
        <AppText variant="bodyStrong">{t('Todos os hábitos')}</AppText>
        <Heatmap
          mode={period.mode}
          range={period.range}
          values={values}
          color={colors.primary}
          onColor={colors.onPrimary}
          weekStartsOn={weekStartsOn}
          today={today}
          selected={selected}
          onSelect={setSelected}
          accessibilityLabel={t(
            'Mapa de calor de {range}: média de {percent} de conclusão, {days} dias perfeitos.',
            {
              range: rangeLabel,
              percent: summary.averageRatio === null ? '0%' : formatPercent(summary.averageRatio),
              days: summary.perfectDays,
            },
          )}
        />
        <HeatmapLegend color={colors.primary} />
        <AppText tone="muted" accessibilityLiveRegion="polite">
          {selected
            ? `${capitalize(formatDayLabel(selected, today))}: ${
                selectedScore
                  ? t('{completed} de {total} concluídos ({percent})', {
                      completed: selectedScore.completed,
                      total: selectedScore.total,
                      percent: formatPercent(selectedScore.ratio),
                    })
                  : 'nada para contar'
              }`
            : t('Toque em um dia para ver os detalhes.')}
        </AppText>
        <View style={styles.summary}>
          <SummaryItem
            label={t('Média de conclusão')}
            value={summary.averageRatio === null ? '—' : formatPercent(summary.averageRatio)}
          />
          <SummaryItem label={t('Dias perfeitos')} value={String(summary.perfectDays)} />
          <SummaryItem label={t('Dias ativos')} value={String(summary.activeDays)} />
        </View>
      </Card>

      <AppText variant="heading" accessibilityRole="header">
        {t('Por hábito')}
      </AppText>
      <Card style={styles.list}>
        {active.map((habit) => {
          const stats = habitStats(habit, entries ?? [], period.range, today, weekStartsOn);
          const streak = streaks.get(habit.id);
          const rate = stats.completionRate === null ? '—' : formatPercent(stats.completionRate);
          const streakText = streak ? describeStreak(streak.current, streak.unit) : '—';
          return (
            <Pressable
              key={habit.id}
              onPress={() => router.push(`/stats/${habit.id}`)}
              accessibilityRole="button"
              accessibilityLabel={t('{name}: {rate} de conclusão, sequência de {streak}', {
                name: habit.name,
                rate,
                streak: streakText,
              })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <HabitIcon icon={habit.icon} color={habit.color} />
              <View style={styles.rowText}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {habit.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  🔥 {streakText}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{rate}</AppText>
              <Icon name="chevron-right" color={colors.textMuted} />
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  summaryItem: { flex: 1 },
  list: { padding: spacing.sm, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    padding: spacing.xs,
  },
  rowText: { flex: 1 },
});
