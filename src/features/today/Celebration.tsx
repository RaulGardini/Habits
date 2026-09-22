import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { HABIT_COLORS } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

const DURATION = 2200;

export interface CelebrationContent {
  message: string;
  /** Fewer pieces for smaller wins (a streak milestone). */
  pieces: number;
}

/** Confetti + a short message: the day is complete, or a habit hit a streak milestone. */
export function Celebration({
  content,
  onDone,
}: {
  content: CelebrationContent | null;
  onDone: () => void;
}) {
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  // Deterministic spread (the golden ratio scatters the pieces evenly without randomness).
  const count = content?.pieces ?? 0;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        x: width * (((index + 1) * 0.618033) % 1),
        delay: (index % 7) * 70,
        size: 7 + (index % 5),
        spin: index % 2 === 0 ? 1 : -1,
        color: (HABIT_COLORS[index % HABIT_COLORS.length] ?? HABIT_COLORS[0])![scheme].solid,
      })),
    [count, width, scheme],
  );

  useEffect(() => {
    if (!content) return;
    const id = setTimeout(onDone, DURATION + 400);
    return () => clearTimeout(id);
  }, [content, onDone]);

  if (!content) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((piece) => (
        <Piece key={piece.id} {...piece} travel={height} />
      ))}
      <View style={styles.center}>
        <View style={[styles.toast, { backgroundColor: colors.primary }]}>
          <AppText variant="bodyStrong" tone={colors.onPrimary}>
            {content.message}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function Piece({
  x,
  delay,
  size,
  spin,
  color,
  travel,
}: {
  x: number;
  delay: number;
  size: number;
  spin: number;
  color: string;
  travel: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(delay, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) })),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const value = progress.get();
    return {
      transform: [
        { translateY: -40 + value * (travel + 80) },
        { translateX: Math.sin(value * 6) * 24 * spin },
        { rotate: `${value * 540 * spin}deg` },
      ],
      opacity: value > 0.85 ? (1 - value) / 0.15 : 1,
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: x, width: size, height: size * 1.6, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
});
