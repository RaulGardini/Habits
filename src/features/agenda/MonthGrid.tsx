import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { weeksGrid } from '@/core/dates/calendar';
import { formatDayLabel, parseLocalDate, type LocalDate } from '@/core/dates/localDate';
import type { DateRange } from '@/core/dates/periods';
import { orderedWeekdays, WEEKDAY_LETTER } from '@/core/dates/weekdays';
import type { WeekStartsOn } from '@/core/habits/types';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

interface MonthGridProps {
  range: DateRange;
  today: LocalDate;
  selected: LocalDate;
  weekStartsOn: WeekStartsOn;
  /** Event colors (palette keys) per day; up to 3 dots are shown. */
  dots?: ReadonlyMap<LocalDate, string[]>;
  onSelect: (date: LocalDate) => void;
  /** Days before this one cannot be picked (date pickers). */
  minDate?: LocalDate;
}

/** Month calendar: today in soft yellow, selected day filled, a colored dot per event. */
export function MonthGrid({
  range,
  today,
  selected,
  weekStartsOn,
  dots,
  onSelect,
  minDate,
}: MonthGridProps) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const gap = 2;
  const cell = width > 0 ? Math.floor((width - gap * 6) / 7) : 0;
  const size = Math.min(cell, 52);
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
                if (!date) return <View key={column} style={{ width: cell, height: size }} />;
                const isSelected = date === selected;
                const isToday = date === today;
                const disabled = minDate !== undefined && date < minDate;
                const dayDots = dots?.get(date) ?? [];
                const count = dayDots.length;
                return (
                  <Pressable
                    key={date}
                    onPress={() => onSelect(date)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled }}
                    accessibilityLabel={[
                      formatDayLabel(date, today),
                      count > 0 ? `${count} ${count === 1 ? 'evento' : 'eventos'}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    style={[styles.slot, { width: cell, height: size }]}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.day,
                          { width: size - 6, height: size - 6 },
                          isToday && { backgroundColor: colors.primarySoft },
                          isSelected && { backgroundColor: colors.primary },
                          pressed && !isSelected && { backgroundColor: colors.surfaceMuted },
                          disabled && styles.disabled,
                        ]}
                      >
                        <AppText
                          variant={isSelected || isToday ? 'label' : 'body'}
                          tone={isSelected ? colors.onPrimary : 'default'}
                        >
                          {parseLocalDate(date).getDate()}
                        </AppText>
                        <View style={styles.dots}>
                          {dayDots.slice(0, 3).map((color, index) => (
                            <View
                              key={index}
                              style={[
                                styles.dot,
                                {
                                  backgroundColor: isSelected
                                    ? colors.onPrimary
                                    : resolveHabitColor(color, scheme).solid,
                                },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: { flexDirection: 'row' },
  weekday: { textAlign: 'center', paddingBottom: 4 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  day: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  disabled: { opacity: 0.3 },
});
