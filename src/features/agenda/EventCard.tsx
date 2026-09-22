import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/core/dates/localDate';
import {
  endMinutes,
  eventTimeLabel,
  formatDuration,
  repeatShortLabel,
} from '@/core/planner/agenda';
import { minutesOf } from '@/core/planner/planner';
import type { PlannerEvent } from '@/core/planner/types';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, softShadow, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

/** Opens the editor of an occurrence (`date` lets "delete only this day" work for series). */
export function openEvent(event: PlannerEvent, date: LocalDate): void {
  router.push({ pathname: '/event/[id]', params: { id: event.id, date } });
}

interface EventCardProps {
  event: PlannerEvent;
  date: LocalDate;
  conflict?: boolean;
  /** Happening right now (highlighted). */
  live?: boolean;
}

/** Agenda row: color bar, time, title and the details that exist (place, repeat, reminder). */
export function EventCard({ event, date, conflict = false, live = false }: EventCardProps) {
  const { colors, scheme } = useTheme();
  const color = resolveHabitColor(event.color, scheme);
  const duration =
    !event.allDay && event.endTime ? endMinutes(event) - minutesOf(event.startTime) : null;

  return (
    <Pressable
      onPress={() => openEvent(event, date)}
      accessibilityRole="button"
      accessibilityLabel={[
        event.title,
        eventTimeLabel(event),
        event.location,
        live ? 'agora' : null,
        conflict ? 'conflita com outro evento' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, boxShadow: softShadow(colors.shadow) },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: color.solid }]} />
      <View style={styles.time}>
        <AppText variant="label">{event.allDay ? 'Dia' : event.startTime}</AppText>
        <AppText variant="caption" tone="muted">
          {event.allDay ? 'inteiro' : (event.endTime ?? '')}
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
            {event.title}
          </AppText>
          {live ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <AppText variant="caption" tone={colors.onPrimary}>
                Agora
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.meta}>
          {duration ? <Meta icon="clock-outline" text={formatDuration(duration)} /> : null}
          {event.location ? <Meta icon="map-marker-outline" text={event.location} /> : null}
          {event.repeat !== 'none' ? (
            <Meta icon="repeat" text={repeatShortLabel(event.repeat)} />
          ) : null}
          {event.reminderMinutes !== null ? <Meta icon="bell-outline" /> : null}
          {conflict ? (
            <Meta icon="alert-circle-outline" text="Conflito" color={colors.danger} />
          ) : null}
        </View>
        {event.note ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {event.note}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function Meta({ icon, text, color }: { icon: string; text?: string; color?: string }) {
  const { colors } = useTheme();
  const tone = color ?? colors.textMuted;
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={14} color={tone} />
      {text ? (
        <AppText variant="caption" tone={tone} numberOfLines={1}>
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  time: { width: 46, gap: 2 },
  body: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
});
