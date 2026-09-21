import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/core/dates/localDate';
import { minutesOf, sortEvents } from '@/core/planner/planner';
import type { PlannerEvent } from '@/core/planner/types';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

interface EventTimelineProps {
  date: LocalDate;
  events: readonly PlannerEvent[];
  /** Minutes since midnight when viewing today (shows a "now" marker). */
  nowMinutes: number | null;
}

/** Events as a vertical timeline, with a "now" marker when looking at today. */
export function EventTimeline({ date, events, nowMinutes }: EventTimelineProps) {
  const { colors } = useTheme();
  const sorted = sortEvents(events);
  const nowIndex =
    nowMinutes === null ? -1 : sorted.findIndex((e) => minutesOf(e.startTime) > nowMinutes);

  const nowMarker = (
    <View key="now" style={styles.nowRow} accessibilityLabel="Agora">
      <AppText variant="caption" tone={colors.danger} style={styles.time}>
        Agora
      </AppText>
      <View style={[styles.nowLine, { backgroundColor: colors.danger }]} />
    </View>
  );

  const items = sorted.map((event, index) => (
    <View key={event.id}>
      {index === nowIndex ? nowMarker : null}
      <EventItem event={event} />
    </View>
  ));

  return (
    <View style={styles.container}>
      {sorted.length === 0 ? <AppText tone="muted">Nenhum evento neste dia.</AppText> : null}
      <View style={[styles.timeline, { borderLeftColor: colors.border }]}>
        {items}
        {nowMinutes !== null && nowIndex === -1 && sorted.length > 0 ? nowMarker : null}
      </View>
      <Button
        variant="ghost"
        icon="calendar-plus"
        label="Novo evento"
        onPress={() => router.push({ pathname: '/event/new', params: { date } })}
      />
    </View>
  );
}

function EventItem({ event }: { event: PlannerEvent }) {
  const { colors, scheme } = useTheme();
  const color = resolveHabitColor(event.color, scheme);
  const time = event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${time}, ${event.title}`}
      style={({ pressed }) => [styles.eventRow, pressed && { opacity: 0.7 }]}
    >
      <AppText variant="label" tone="muted" style={styles.time}>
        {event.startTime}
      </AppText>
      <View
        style={[styles.dot, { backgroundColor: color.solid, borderColor: colors.background }]}
      />
      <View style={[styles.card, { backgroundColor: color.soft, borderLeftColor: color.solid }]}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {time}
        </AppText>
        {event.note ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {event.note}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const TIME_WIDTH = 48;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  timeline: { gap: spacing.sm, marginLeft: TIME_WIDTH + spacing.sm, borderLeftWidth: 2 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: -(TIME_WIDTH + spacing.sm),
    minHeight: MIN_TOUCH_SIZE,
  },
  time: { width: TIME_WIDTH, paddingTop: spacing.sm, textAlign: 'right', marginRight: spacing.sm },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    borderWidth: 2,
    marginLeft: -7,
    marginTop: spacing.sm + 2,
    marginRight: spacing.sm,
  },
  card: {
    flex: 1,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.sm,
    gap: 2,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -(TIME_WIDTH + spacing.sm),
  },
  nowLine: { flex: 1, height: 2, marginLeft: -spacing.sm - 1 },
});
