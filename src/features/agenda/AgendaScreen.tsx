import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  addDaysLocal,
  formatDayLabel,
  todayLocal,
  weekdayOf,
  type LocalDate,
} from '@/core/dates/localDate';
import { eachDay, periodRange, shiftPeriod } from '@/core/dates/periods';
import { weekdayShort } from '@/core/dates/weekdays';
import { capitalize } from '@/core/format';
import { conflictingIds, endMinutes, expandOccurrences, groupByDate } from '@/core/planner/agenda';
import { minutesOf } from '@/core/planner/planner';
import type { WeekStartsOn } from '@/core/habits/types';
import type { EventOccurrence } from '@/core/planner/types';
import { useNow } from '@/hooks/useNow';
import { useEvents } from '@/stores/plannerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { EmptyState } from '@/ui/EmptyState';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';

import { DayTimeline } from './DayTimeline';
import { EventCard } from './EventCard';
import { monthLabel, weekLabel } from './format';
import { MonthGrid } from './MonthGrid';
import { t } from '@/i18n/i18n';
import { hapticSelection } from '@/lib/haptics';
import { GlassAddButton } from '@/ui/GlassAddButton';

type AgendaMode = 'day' | 'week' | 'month' | 'list';

function MODE_OPTIONS() {
  return [
    { value: 'day', label: t('Dia') },
    { value: 'week', label: t('Semana') },
    { value: 'month', label: t('Mês') },
    { value: 'list', label: t('Próximos') },
  ] as const;
}

/** Days loaded by the "Próximos" list (grows with "Mostrar mais"). */
const LIST_PAGE_DAYS = 60;

function newEvent(date: LocalDate) {
  router.push({ pathname: '/event/new', params: { date } });
}

export function AgendaScreen() {
  const now = useNow();
  const today = todayLocal(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const [mode, setMode] = useState<AgendaMode>('month');
  // null = follow today (also after midnight).
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const date = picked ?? today;
  const select = (next: LocalDate) => setPicked(next === today ? null : next);
  const [listDays, setListDays] = useState(LIST_PAGE_DAYS);
  const [query, setQuery] = useState('');

  const range = useMemo(() => {
    switch (mode) {
      case 'day':
        return { from: date, to: date };
      case 'week':
        return periodRange(date, 'week', weekStartsOn);
      case 'month':
        return periodRange(date, 'month', weekStartsOn);
      case 'list':
        return { from: today, to: addDaysLocal(today, listDays - 1) };
    }
  }, [mode, date, today, weekStartsOn, listDays]);

  const events = useEvents(range.from, range.to);
  const occurrences = useMemo(
    () => expandOccurrences(events ?? [], range.from, range.to),
    [events, range.from, range.to],
  );
  const byDay = useMemo(() => groupByDate(occurrences), [occurrences]);

  const step = (amount: number) => {
    hapticSelection();
    if (mode === 'day') select(addDaysLocal(date, amount));
    else if (mode === 'week') select(addDaysLocal(date, amount * 7));
    else select(shiftPeriod(date, 'month', amount));
  };

  const title =
    mode === 'day'
      ? capitalize(formatDayLabel(date, today))
      : mode === 'week'
        ? weekLabel(range.from, range.to)
        : mode === 'month'
          ? capitalize(monthLabel(date))
          : t('Próximos dias');

  const isLive = (occurrence: EventOccurrence) =>
    occurrence.date === today &&
    !occurrence.event.allDay &&
    minutesOf(occurrence.event.startTime) <= nowMinutes &&
    nowMinutes < endMinutes(occurrence.event);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header">
            {t('Agenda')}
          </AppText>
          <AppText tone="muted">
            {summaryLine(
              today >= range.from && today <= range.to ? (byDay.get(today)?.length ?? 0) : null,
              mode,
            )}
          </AppText>
        </View>
        <GlassAddButton
          label={t('Novo evento')}
          onPress={() => newEvent(mode === 'list' ? today : date)}
        />
      </View>

      <SegmentedControl<AgendaMode>
        label={t('Visualização')}
        options={MODE_OPTIONS()}
        value={mode}
        onChange={setMode}
        hideLabel
      />

      {mode !== 'list' ? (
        <View style={styles.navRow}>
          <AppText variant="heading" style={styles.flex} accessibilityLiveRegion="polite">
            {title}
          </AppText>
          <Glass interactive style={styles.navPill}>
            <NavButton icon="chevron-left" label={t('Anterior')} onPress={() => step(-1)} />
            <Pressable
              onPress={() => {
                hapticSelection();
                setPicked(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Ir para hoje')}
              style={styles.todayButton}
            >
              <AppText variant="label">{t('Hoje')}</AppText>
            </Pressable>
            <NavButton icon="chevron-right" label={t('Próximo')} onPress={() => step(1)} />
          </Glass>
        </View>
      ) : null}

      {mode === 'month' ? (
        <MonthView
          date={date}
          today={today}
          range={range}
          weekStartsOn={weekStartsOn}
          byDay={byDay}
          onSelect={select}
          isLive={isLive}
        />
      ) : null}
      {mode === 'week' ? (
        <WeekView
          date={date}
          today={today}
          days={eachDay(range.from, range.to)}
          byDay={byDay}
          onSelect={select}
          isLive={isLive}
        />
      ) : null}
      {mode === 'day' ? (
        <DayView
          date={date}
          occurrences={byDay.get(date) ?? []}
          nowMinutes={date === today ? nowMinutes : null}
        />
      ) : null}
      {mode === 'list' ? (
        <ListView
          today={today}
          occurrences={occurrences}
          query={query}
          onQuery={setQuery}
          onMore={() => setListDays((days) => days + LIST_PAGE_DAYS)}
          until={range.to}
          isLive={isLive}
        />
      ) : null}
    </Screen>
  );
}

function MonthView(props: {
  date: LocalDate;
  today: LocalDate;
  range: { from: LocalDate; to: LocalDate };
  weekStartsOn: WeekStartsOn;
  byDay: Map<LocalDate, EventOccurrence[]>;
  onSelect: (date: LocalDate) => void;
  isLive: (o: EventOccurrence) => boolean;
}) {
  const dots = new Map(
    [...props.byDay].map(([day, list]) => [day, list.map((o) => o.event.color)]),
  );
  return (
    <>
      <View style={styles.calendarCard}>
        <MonthGrid
          range={props.range}
          today={props.today}
          selected={props.date}
          weekStartsOn={props.weekStartsOn}
          dots={dots}
          onSelect={props.onSelect}
        />
      </View>
      <DaySection
        date={props.date}
        today={props.today}
        occurrences={props.byDay.get(props.date) ?? []}
        isLive={props.isLive}
      />
    </>
  );
}

function summaryLine(todayCount: number | null, mode: AgendaMode): string {
  if (mode === 'list') return t('O que vem por aí.');
  if (todayCount === null) return t('Seus compromissos, com calma.');
  if (todayCount === 0) return t('Nada marcado para hoje.');
  return todayCount === 1
    ? t('1 compromisso hoje.')
    : t('{count} compromissos hoje.', { count: todayCount });
}

function NavButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.navButton}
    >
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/** One day: header + its events, or a gentle empty line. */
function DaySection({
  date,
  today,
  occurrences,
  isLive,
  compact = false,
}: {
  date: LocalDate;
  today: LocalDate;
  occurrences: readonly EventOccurrence[];
  isLive: (o: EventOccurrence) => boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const conflicts = conflictingIds(occurrences);
  const isToday = date === today;
  return (
    <View style={styles.daySection}>
      <View style={styles.dayHeader}>
        <AppText variant={compact ? 'label' : 'heading'} tone={isToday ? colors.accent : 'default'}>
          {capitalize(formatDayLabel(date, today))}
        </AppText>
        {compact ? null : (
          <Pressable
            onPress={() => newEvent(date)}
            accessibilityRole="button"
            accessibilityLabel={t('Adicionar evento neste dia')}
            hitSlop={8}
            style={styles.inlineAdd}
          >
            <Icon name="plus" size={18} color={colors.accent} />
            <AppText variant="label" tone={colors.accent}>
              {t('Adicionar')}
            </AppText>
          </Pressable>
        )}
      </View>
      {occurrences.length === 0 ? (
        <AppText tone="muted" variant={compact ? 'caption' : 'body'}>
          {compact ? t('Livre') : t('Dia livre. Que tal reservar um tempo para você?')}
        </AppText>
      ) : (
        occurrences.map((o) => (
          <EventCard
            key={`${o.event.id}|${o.date}`}
            event={o.event}
            date={o.date}
            conflict={conflicts.has(o.event.id)}
            live={isLive(o)}
          />
        ))
      )}
    </View>
  );
}

function WeekView({
  date,
  today,
  days,
  byDay,
  onSelect,
  isLive,
}: {
  date: LocalDate;
  today: LocalDate;
  days: LocalDate[];
  byDay: Map<LocalDate, EventOccurrence[]>;
  onSelect: (date: LocalDate) => void;
  isLive: (o: EventOccurrence) => boolean;
}) {
  const { colors } = useTheme();
  const total = days.reduce((sum, day) => sum + (byDay.get(day)?.length ?? 0), 0);
  return (
    <>
      <View style={styles.weekStrip}>
        {days.map((day) => {
          const selected = day === date;
          const count = byDay.get(day)?.length ?? 0;
          return (
            <Pressable
              key={day}
              onPress={() => {
                hapticSelection();
                onSelect(day);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatDayLabel(day, today)}, ${t('{count} eventos', { count })}`}
              style={[
                styles.weekDay,
                day === today && { backgroundColor: colors.primarySoft },
                selected && { backgroundColor: colors.primary },
              ]}
            >
              <AppText variant="caption" tone={selected ? colors.onPrimary : 'muted'}>
                {weekdayShort(weekdayOf(day))}
              </AppText>
              <AppText variant="bodyStrong" tone={selected ? colors.onPrimary : 'default'}>
                {Number(day.slice(8))}
              </AppText>
              <View
                style={[
                  styles.weekDot,
                  count > 0 && { backgroundColor: selected ? colors.onPrimary : colors.accent },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <AppText tone="muted">
        {total === 0
          ? t('Semana tranquila, sem compromissos.')
          : total === 1
            ? t('1 compromisso nesta semana.')
            : t('{count} compromissos nesta semana.', { count: total })}
      </AppText>
      {days.map((day) => (
        <DaySection
          key={day}
          date={day}
          today={today}
          occurrences={byDay.get(day) ?? []}
          isLive={isLive}
          compact
        />
      ))}
    </>
  );
}

function DayView({
  date,
  occurrences,
  nowMinutes,
}: {
  date: LocalDate;
  occurrences: readonly EventOccurrence[];
  nowMinutes: number | null;
}) {
  const { colors } = useTheme();
  const allDay = occurrences.filter((o) => o.event.allDay);
  return (
    <>
      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <AppText variant="label" tone="muted">
            {t('Dia inteiro')}
          </AppText>
          {allDay.map((o) => (
            <EventCard key={o.event.id} event={o.event} date={o.date} />
          ))}
        </View>
      ) : null}
      {occurrences.length === 0 ? (
        <AppText tone="muted">
          {t('Nenhum compromisso. Toque em um horário para adicionar.')}
        </AppText>
      ) : null}
      <View style={[styles.timelineCard, { backgroundColor: colors.surface }]}>
        <DayTimeline date={date} occurrences={occurrences} nowMinutes={nowMinutes} />
      </View>
    </>
  );
}

function ListView({
  today,
  occurrences,
  query,
  onQuery,
  onMore,
  until,
  isLive,
}: {
  today: LocalDate;
  occurrences: readonly EventOccurrence[];
  query: string;
  onQuery: (query: string) => void;
  onMore: () => void;
  until: LocalDate;
  isLive: (o: EventOccurrence) => boolean;
}) {
  const { colors } = useTheme();
  const needle = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = needle
    ? occurrences.filter((o) =>
        [o.event.title, o.event.location, o.event.note].some((text) =>
          text?.toLocaleLowerCase('pt-BR').includes(needle),
        ),
      )
    : occurrences;
  const groups = [...groupByDate(filtered)];

  return (
    <>
      <TextField
        label={t('Buscar')}
        value={query}
        onChangeText={onQuery}
        placeholder={t('Título, local ou observação')}
        autoCorrect={false}
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={needle ? 'magnify' : 'calendar-heart'}
          title={needle ? t('Nada encontrado') : t('Agenda livre')}
          description={
            needle
              ? t('Tente outra palavra ou mostre mais dias.')
              : t('Nenhum compromisso nos próximos dias. Aproveite!')
          }
        />
      ) : (
        groups.map(([day, list]) => (
          <DaySection
            key={day}
            date={day}
            today={today}
            occurrences={list}
            isLive={isLive}
            compact
          />
        ))
      )}
      <Pressable
        onPress={onMore}
        accessibilityRole="button"
        style={[styles.more, { borderColor: colors.border }]}
      >
        <AppText variant="label" tone={colors.accent}>
          {t('Mostrar mais (até {date})', { date: formatDayLabel(until, today).toLowerCase() })}
        </AppText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navPill: { flexDirection: 'row', alignItems: 'center' },
  navButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButton: {
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  calendarCard: { paddingVertical: spacing.xs },
  daySection: { gap: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.xs,
  },
  weekStrip: { flexDirection: 'row', gap: spacing.xs },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 2,
    minHeight: MIN_TOUCH_SIZE,
  },
  weekDot: { width: 5, height: 5, borderRadius: 2.5 },
  allDay: { gap: spacing.sm },
  timelineCard: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
  },
  more: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
