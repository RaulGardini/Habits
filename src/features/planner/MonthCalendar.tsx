import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { weeksGrid } from '@/core/dates/calendar';
import { formatDayLabel, parseLocalDate, type LocalDate } from '@/core/dates/localDate';
import type { DateRange } from '@/core/dates/periods';
import { orderedWeekdays, WEEKDAY_LETTER } from '@/core/dates/weekdays';
import { formatPercent } from '@/core/format';
import type { WeekStartsOn } from '@/core/habits/types';
import type { DayPlanSummary } from '@/core/planner/planner';
import { intensityLevel, type DayScore } from '@/core/stats/stats';
import { withAlpha } from '@/theme/contrast';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

const LEVEL_ALPHA = [0.18, 0.32, 0.5, 0.7] as const;

interface MonthCalendarProps {
  range: DateRange;
  today: LocalDate;
  weekStartsOn: WeekStartsOn;
  habitScores: ReadonlyMap<LocalDate, DayScore | null>;
  plans: ReadonlyMap<LocalDate, DayPlanSummary>;
  onSelect: (date: LocalDate) => void;
}

/** Month calendar: habit completion as background tint, dots for pending tasks and events. */
export function MonthCalendar({
  range,
  today,
  weekStartsOn,
  habitScores,
  plans,
  onSelect,
}: MonthCalendarProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const gap = 4;
  const cell = width > 0 ? Math.floor((width - gap * 6) / 7) : 0;
  const weeks = weeksGrid(range.from, range.to, weekStartsOn);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      <View style={[styles.row, { gap }]}>
        {orderedWeekdays(weekStartsOn).map((weekday) => (
          <AppText
            key={weekday}
            variant="caption"
            tone="muted"
            style={[styles.weekday, { width: cell }]}
          >
            {WEEKDAY_LETTER[weekday]}
          </AppText>
        ))}
      </View>
      {cell > 0
        ? weeks.map((week, row) => (
            <View key={row} style={[styles.row, { gap }]}>
              {week.map((date, column) => {
                if (!date) return <View key={column} style={{ width: cell, height: cell }} />;
                const score = habitScores.get(date) ?? null;
                const plan = plans.get(date);
                const level = score ? intensityLevel(score.ratio) : 0;
                const isToday = date === today;
                const label = [
                  formatDayLabel(date, today),
                  plan?.pendingTasks ? `${plan.pendingTasks} tarefas pendentes` : null,
                  plan?.events ? `${plan.events} eventos` : null,
                  score ? `${formatPercent(score.ratio)} dos hábitos` : null,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <Pressable
                    key={date}
                    onPress={() => onSelect(date)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      styles.cell,
                      {
                        width: cell,
                        height: cell,
                        backgroundColor:
                          level > 0
                            ? withAlpha(colors.primary, LEVEL_ALPHA[level - 1] ?? 1)
                            : colors.surface,
                        borderColor: isToday ? colors.primary : colors.border,
                        borderWidth: isToday ? 2 : StyleSheet.hairlineWidth,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <AppText
                      variant={isToday ? 'label' : 'caption'}
                      tone={date > today ? 'muted' : 'default'}
                    >
                      {parseLocalDate(date).getDate()}
                    </AppText>
                    <View style={styles.dots}>
                      {plan?.pendingTasks ? (
                        <View style={[styles.dot, { backgroundColor: colors.text }]} />
                      ) : null}
                      {plan?.events ? (
                        <View style={[styles.dot, styles.eventDot, { borderColor: colors.text }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        : null}
      <View
        style={styles.legend}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.dot, { backgroundColor: colors.text }]} />
        <AppText variant="caption" tone="muted">
          Tarefas pendentes
        </AppText>
        <View style={[styles.dot, styles.eventDot, { borderColor: colors.text }]} />
        <AppText variant="caption" tone="muted">
          Eventos
        </AppText>
        <View style={[styles.swatch, { backgroundColor: withAlpha(colors.primary, 0.5) }]} />
        <AppText variant="caption" tone="muted">
          Hábitos concluídos
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row' },
  weekday: { textAlign: 'center' },
  cell: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eventDot: { backgroundColor: 'transparent', borderWidth: 1.5 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
