import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { formatClock, formatNumber } from '@/core/format';
import { entryProgress } from '@/core/habits/entries';
import type { PeriodQuota } from '@/core/habits/quota';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { STATUS_ICON, STATUS_LABEL } from '@/features/habits/labels';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

const RING = 4;

interface HabitBubbleProps {
  habit: Habit;
  entry: HabitEntry | undefined;
  quota: PeriodQuota | null;
  /** Seconds recorded + running, for timer habits. */
  timerSeconds: number | null;
  running: boolean;
  disabled: boolean;
  /** Circle diameter. */
  size: number;
  /** Item width (the name wraps within it). */
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}

/** One habit on the Today screen: a colored circle with its icon, progress ring and name. */
export function HabitBubble({
  habit,
  entry,
  quota,
  timerSeconds,
  running,
  disabled,
  size,
  width,
  onPress,
  onLongPress,
}: HabitBubbleProps) {
  const { colors, scheme } = useTheme();
  const color = resolveHabitColor(habit.color, scheme);
  const status = entry?.status;
  const progress =
    habit.tracking.type === 'timer' && timerSeconds !== null
      ? Math.min(1, timerSeconds / habit.tracking.targetSeconds)
      : entryProgress(habit, entry);
  const done = status === 'done' || progress >= 1;
  const resting = status === 'skipped' || status === 'missed' || (quota?.met && !done);

  // Pop when the habit becomes done.
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      scale.set(withSequence(withTiming(1.15, { duration: 120 }), withSpring(1)));
    }
    wasDone.current = done;
  }, [done, scale]);

  const detail = bubbleDetail(habit, entry, quota, timerSeconds);
  const radiusRing = (size - RING) / 2;
  const circumference = 2 * Math.PI * radiusRing;
  const inner = size - RING * 2 - 4;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[habit.name, done ? 'feito' : null, detail].filter(Boolean).join(', ')}
      accessibilityHint={
        disabled ? 'Não é possível registrar dias futuros' : 'Toque para registrar'
      }
      accessibilityState={{ disabled, checked: done }}
      style={({ pressed }) => [
        styles.item,
        { width },
        pressed && styles.pressed,
        (disabled || resting) && styles.resting,
      ]}
    >
      <Animated.View style={[{ width: size, height: size }, animated]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radiusRing}
            stroke={color.soft}
            strokeWidth={RING}
            fill="none"
          />
          {progress > 0 && !done ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radiusRing}
              stroke={color.solid}
              strokeWidth={RING}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * progress} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View
          style={[
            styles.inner,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              top: RING + 2,
              left: RING + 2,
              backgroundColor: done ? color.solid : color.soft,
            },
          ]}
        >
          <Icon name={habit.icon} size={inner * 0.46} color={done ? color.onSolid : color.solid} />
        </View>
        {done || running || status === 'skipped' ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surface, borderColor: colors.background },
            ]}
          >
            <Icon
              name={running ? 'timer-outline' : done ? 'check-bold' : STATUS_ICON.skipped}
              size={11}
              color={done ? color.solid : colors.textMuted}
            />
          </View>
        ) : null}
      </Animated.View>
      <AppText variant="label" numberOfLines={2} style={styles.name}>
        {habit.name}
      </AppText>
      {detail ? (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function bubbleDetail(
  habit: Habit,
  entry: HabitEntry | undefined,
  quota: PeriodQuota | null,
  timerSeconds: number | null,
): string | null {
  if (entry?.status === 'skipped' || entry?.status === 'missed') return STATUS_LABEL[entry.status];
  if (habit.tracking.type === 'quantity') {
    return `${formatNumber(entry?.value ?? 0)}/${formatNumber(habit.tracking.target)} ${habit.tracking.unit}`;
  }
  if (habit.tracking.type === 'timer') {
    return `${formatClock(timerSeconds ?? 0)}/${Math.round(habit.tracking.targetSeconds / 60)} min`;
  }
  if (quota)
    return `${quota.done}/${quota.target} ${quota.unit === 'week' ? 'na semana' : 'no mês'}`;
  return null;
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  resting: { opacity: 0.45 },
  inner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { textAlign: 'center', fontSize: 12, lineHeight: 15 },
  detail: { textAlign: 'center', fontSize: 10, lineHeight: 13 },
});
