import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { LocalDate } from '@/core/dates/localDate';
import { endMinutes, layoutColumns } from '@/core/planner/agenda';
import { minutesOf } from '@/core/planner/planner';
import type { EventOccurrence } from '@/core/planner/types';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

import { openEvent } from './EventCard';

const HOUR_HEIGHT = 56;
const GUTTER = 48;
const DEFAULT_FIRST_HOUR = 7;

interface DayTimelineProps {
  date: LocalDate;
  /** Timed occurrences of the day (all-day ones are shown above the timeline). */
  occurrences: readonly EventOccurrence[];
  /** Minutes since midnight when `date` is today (draws the "now" line). */
  nowMinutes: number | null;
}

/** Hour grid of one day. Overlapping events share the width; tap a free hour to add one. */
export function DayTimeline({ date, occurrences, nowMinutes }: DayTimelineProps) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const timed = occurrences.filter((o) => !o.event.allDay);
  const layout = layoutColumns(timed);
  const earliest = timed.reduce(
    (hour, o) => Math.min(hour, Math.floor(minutesOf(o.event.startTime) / 60)),
    nowMinutes === null ? DEFAULT_FIRST_HOUR : Math.floor(nowMinutes / 60),
  );
  const firstHour = Math.min(DEFAULT_FIRST_HOUR, earliest);
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i);
  const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR_HEIGHT;
  const columnWidth = Math.max(0, width - GUTTER - spacing.xs);

  return (
    <View
      style={{ height: hours.length * HOUR_HEIGHT }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {hours.map((hour) => (
        <Pressable
          key={hour}
          onPress={() =>
            router.push({ pathname: '/event/new', params: { date, hour: String(hour) } })
          }
          accessibilityRole="button"
          accessibilityLabel={`Novo evento às ${hour} horas`}
          style={({ pressed }) => [
            styles.hour,
            { top: top(hour * 60), borderColor: colors.border },
            pressed && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <AppText variant="caption" tone="muted" style={styles.hourLabel}>
            {`${String(hour).padStart(2, '0')}:00`}
          </AppText>
        </Pressable>
      ))}

      {timed.map(({ event }) => {
        const slot = layout.get(event.id) ?? { column: 0, columns: 1 };
        const start = minutesOf(event.startTime);
        const height = Math.max(26, ((endMinutes(event) - start) / 60) * HOUR_HEIGHT - 2);
        const color = resolveHabitColor(event.color, scheme);
        const w = columnWidth / slot.columns;
        return (
          <Pressable
            key={event.id}
            onPress={() => openEvent(event, date)}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${event.startTime}${event.endTime ? ` até ${event.endTime}` : ''}`}
            style={({ pressed }) => [
              styles.block,
              {
                top: top(start) + 1,
                height,
                left: GUTTER + slot.column * w,
                width: w - 2,
                backgroundColor: color.soft,
                borderLeftColor: color.solid,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <AppText variant="label" numberOfLines={height > 40 ? 2 : 1}>
              {event.title}
            </AppText>
            {height > 44 ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime}
                {event.location ? ` · ${event.location}` : ''}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}

      {nowMinutes !== null && nowMinutes >= firstHour * 60 ? (
        <View
          pointerEvents="none"
          style={[styles.now, { top: top(nowMinutes) - 5, left: GUTTER - 5 }]}
          accessibilityElementsHidden
        >
          <View style={[styles.nowDot, { backgroundColor: colors.danger }]} />
          <View style={[styles.nowLine, { backgroundColor: colors.danger }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hour: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hourLabel: { width: GUTTER - spacing.sm, marginTop: -9, paddingTop: 0 },
  block: {
    position: 'absolute',
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  now: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 10, height: 10, borderRadius: 5 },
  nowLine: { flex: 1, height: 2 },
});
