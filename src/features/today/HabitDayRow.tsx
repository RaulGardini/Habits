import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { LocalDate } from '@/core/dates/localDate';
import { formatClock, formatNumber } from '@/core/format';
import { entryProgress, statusForValue } from '@/core/habits/entries';
import type { PeriodQuota } from '@/core/habits/quota';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { STATUS_ICON, STATUS_LABEL, describeTarget } from '@/features/habits/labels';
import { useNow } from '@/hooks/useNow';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { elapsedSeconds, type ActiveTimer } from '@/stores/timerStore';
import { resolveHabitColor, type ResolvedHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { ProgressBar } from '@/ui/ProgressBar';

export interface HabitDayRowProps {
  habit: Habit;
  date: LocalDate;
  entry: HabitEntry | undefined;
  /** Future days cannot be recorded. */
  disabled: boolean;
  /** Weekly/monthly progress for flexible habits. */
  quota: PeriodQuota | null;
  activeTimer: ActiveTimer | null;
  onToggle: () => void;
  onIncrement: (direction: 1 | -1) => void;
  onTimerToggle: () => void;
}

export function HabitDayRow(props: HabitDayRowProps) {
  switch (props.habit.tracking.type) {
    case 'boolean':
      return <BooleanRow {...props} />;
    case 'quantity':
      return <QuantityRow {...props} />;
    case 'timer':
      return <TimerRow {...props} />;
  }
}

/** Secondary line: flexible quota, skipped/missed status, note. */
function subtitleParts({ entry, quota }: Pick<HabitDayRowProps, 'entry' | 'quota'>): string[] {
  const parts: string[] = [];
  if (quota) {
    const period = quota.unit === 'week' ? 'nesta semana' : 'neste mês';
    parts.push(
      quota.met ? `Meta cumprida ${period} ✓` : `${quota.done} de ${quota.target} ${period}`,
    );
  }
  if (entry?.status === 'skipped' || entry?.status === 'missed')
    parts.push(STATUS_LABEL[entry.status]);
  if (entry?.note) parts.push('com nota');
  return parts;
}

interface ShellProps extends Pick<HabitDayRowProps, 'habit' | 'date' | 'entry' | 'disabled'> {
  color: ResolvedHabitColor;
  highlighted: boolean;
  subtitle: string[];
  /** Main tappable area (for yes/no habits the whole row toggles). */
  onPress?: () => void;
  mainAccessibility?: {
    role: 'checkbox' | 'button';
    label: string;
    checked?: boolean;
    hint?: string;
  };
  progress?: { value: number; label: string };
  controls: ReactNode;
}

function RowShell({
  habit,
  date,
  entry,
  disabled,
  color,
  highlighted,
  subtitle,
  onPress,
  mainAccessibility,
  progress,
  controls,
}: ShellProps) {
  const { colors } = useTheme();
  const dimmed = entry?.status === 'skipped';
  const content = (
    <>
      <HabitIcon icon={habit.icon} color={habit.color} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {habit.name}
        </AppText>
        {subtitle.length > 0 ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle.join(' · ')}
          </AppText>
        ) : null}
        {progress ? (
          <View style={styles.progress}>
            <ProgressBar
              value={progress.value}
              label={progress.label}
              color={color.solid}
              height={6}
            />
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: highlighted ? color.soft : colors.surface,
          borderColor: highlighted ? color.solid : colors.border,
        },
        (disabled || dimmed) && styles.dimmed,
      ]}
    >
      {onPress && mainAccessibility ? (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole={mainAccessibility.role}
          accessibilityLabel={mainAccessibility.label}
          accessibilityHint={
            disabled ? 'Não é possível registrar dias futuros' : mainAccessibility.hint
          }
          accessibilityState={{ checked: mainAccessibility.checked, disabled }}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.main}>{content}</View>
      )}
      {controls}
      <IconButton
        icon="dots-vertical"
        label={`Mais opções de ${habit.name}`}
        onPress={() => router.push({ pathname: '/entry', params: { habitId: habit.id, date } })}
        disabled={disabled}
        color={colors.textMuted}
      />
    </View>
  );
}

function useCheckAnimation() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pop = () => scale.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1)));
  return { style, pop };
}

function BooleanRow({ habit, date, entry, disabled, quota, onToggle }: HabitDayRowProps) {
  const { scheme } = useTheme();
  const color = resolveHabitColor(habit.color, scheme);
  const done = entry?.status === 'done';
  const { style, pop } = useCheckAnimation();

  const handlePress = () => {
    if (done) {
      hapticLight();
    } else {
      hapticSuccess();
      pop();
    }
    onToggle();
  };

  return (
    <RowShell
      habit={habit}
      date={date}
      entry={entry}
      disabled={disabled}
      color={color}
      highlighted={done}
      subtitle={subtitleParts({ entry, quota })}
      onPress={handlePress}
      mainAccessibility={{ role: 'checkbox', label: habit.name, checked: done }}
      controls={
        <Animated.View
          style={style}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={[
              styles.check,
              { borderColor: color.solid },
              done && { backgroundColor: color.solid },
            ]}
          >
            {done ? <Icon name="check-bold" size={20} color={color.onSolid} /> : null}
            {entry?.status === 'skipped' || entry?.status === 'missed' ? (
              <Icon name={STATUS_ICON[entry.status]} size={20} color={color.solid} />
            ) : null}
          </View>
        </Animated.View>
      }
    />
  );
}

function QuantityRow({ habit, date, entry, disabled, quota, onIncrement }: HabitDayRowProps) {
  const { scheme } = useTheme();
  const color = resolveHabitColor(habit.color, scheme);
  if (habit.tracking.type !== 'quantity') return null;
  const { step, unit } = habit.tracking;
  const value = entry?.value ?? 0;
  const done = entry?.status === 'done';
  const progress = entryProgress(habit, entry);
  const valueText = `${formatNumber(value)} / ${describeTarget(habit.tracking)}`;

  const increment = (direction: 1 | -1) => {
    const reachesTarget =
      direction === 1 && !done && statusForValue(habit.tracking, value + step) === 'done';
    if (reachesTarget) hapticSuccess();
    else hapticLight();
    onIncrement(direction);
  };

  return (
    <RowShell
      habit={habit}
      date={date}
      entry={entry}
      disabled={disabled}
      color={color}
      highlighted={done}
      subtitle={[valueText, ...subtitleParts({ entry, quota })]}
      progress={{ value: progress, label: `${habit.name}: ${valueText}` }}
      controls={
        <View style={styles.controls}>
          <IconButton
            icon="minus"
            label={`Remover ${formatNumber(step)} ${unit} de ${habit.name}`}
            onPress={() => increment(-1)}
            disabled={disabled || value <= 0}
            color={color.solid}
          />
          <IconButton
            icon="plus"
            label={`Adicionar ${formatNumber(step)} ${unit} a ${habit.name}`}
            onPress={() => increment(1)}
            disabled={disabled}
            color={color.solid}
          />
        </View>
      }
    />
  );
}

function TimerRow(props: HabitDayRowProps) {
  const { habit, date, entry, disabled, quota, activeTimer, onTimerToggle } = props;
  const { scheme } = useTheme();
  const color = resolveHabitColor(habit.color, scheme);
  const running = activeTimer?.habitId === habit.id && activeTimer.date === date;
  // Only a running timer needs to re-render every second.
  const now = useNow(running ? 1000 : 60_000).getTime();
  if (habit.tracking.type !== 'timer') return null;

  const seconds = running ? elapsedSeconds(activeTimer, now) : (entry?.value ?? 0);
  const target = habit.tracking.targetSeconds;
  const done = seconds >= target;
  const valueText = `${formatClock(seconds)} / ${describeTarget(habit.tracking)}`;

  return (
    <RowShell
      habit={habit}
      date={date}
      entry={entry}
      disabled={disabled}
      color={color}
      highlighted={done}
      subtitle={[valueText, ...subtitleParts({ entry, quota })]}
      progress={{ value: Math.min(1, seconds / target), label: `${habit.name}: ${valueText}` }}
      controls={
        <IconButton
          icon={running ? 'pause-circle' : 'play-circle'}
          label={running ? `Pausar timer de ${habit.name}` : `Iniciar timer de ${habit.name}`}
          onPress={() => {
            hapticLight();
            onTimerToggle();
          }}
          disabled={disabled}
          color={color.solid}
          size={32}
        />
      }
    />
  );
}

const CHECK_SIZE = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_SIZE + 12,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH_SIZE,
  },
  pressed: { opacity: 0.8 },
  dimmed: { opacity: 0.55 },
  texts: { flex: 1, gap: 2 },
  progress: { marginTop: spacing.xs },
  controls: { flexDirection: 'row' },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    marginLeft: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
