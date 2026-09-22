import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/core/dates/localDate';
import { expandOccurrences } from '@/core/planner/agenda';
import { EventCard } from '@/features/agenda/EventCard';
import { useEvents } from '@/stores/plannerStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { t } from '@/i18n/i18n';

const MAX_SHOWN = 4;

/** The day's agenda under the habits: what is coming up, with a shortcut to the full screen. */
export function TodayAgenda({ date }: { date: LocalDate }) {
  const { colors } = useTheme();
  const events = useEvents(date, date);
  const occurrences = useMemo(() => expandOccurrences(events ?? [], date, date), [events, date]);
  const shown = occurrences.slice(0, MAX_SHOWN);
  const rest = occurrences.length - shown.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {t('Agenda')}
        </AppText>
        <Pressable
          onPress={() => router.push({ pathname: '/event/new', params: { date } })}
          accessibilityRole="button"
          accessibilityLabel={t('Novo evento')}
          hitSlop={8}
          style={styles.action}
        >
          <Icon name="plus" size={18} color={colors.accent} />
          <AppText variant="label" tone={colors.accent}>
            {t('Adicionar')}
          </AppText>
        </Pressable>
      </View>

      {occurrences.length === 0 ? (
        <AppText tone="muted">{t('Nada marcado para este dia.')}</AppText>
      ) : (
        shown.map((occurrence) => (
          <EventCard
            key={`${occurrence.event.id}|${occurrence.date}`}
            event={occurrence.event}
            date={occurrence.date}
          />
        ))
      )}

      <Pressable
        onPress={() => router.push('/agenda')}
        accessibilityRole="button"
        accessibilityLabel={t('Abrir a agenda')}
        style={styles.action}
      >
        <AppText variant="label" tone={colors.accent}>
          {rest > 0
            ? t('Ver mais {count} e a agenda completa', { count: rest })
            : t('Ver agenda completa')}
        </AppText>
        <Icon name="chevron-right" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.xs,
  },
});
