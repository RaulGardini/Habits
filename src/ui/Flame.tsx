import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { flameTierIndex } from '@/core/habits/perfectStreak';
import { flameColors } from '@/theme/flameColors';

/**
 * Round, friendly flame: a nearly circular body, a tall tip on the right and a small hump on the
 * left, with a teardrop core — drawn in a 64×80 box.
 */
const OUTER =
  'M38 8 C 43 18, 55 29, 55 46 C 55 62, 45 74, 32 74 C 19 74, 9 62, 9 46 C 9 37, 13 30, 19 24 C 20 31, 23 35, 27 37 C 30 28, 34 17, 38 8 Z';
const CORE =
  'M32 38 C 35 44, 40 49, 40 56 C 40 63, 36.5 68, 32 68 C 27.5 68, 24 63, 24 56 C 24 49, 29 44, 32 38 Z';
/** Same-color stroke with round joins: the tip and the hump lose their sharp corners. */
const ROUND_OUTER = 7;
const ROUND_CORE = 3;

interface FlameProps {
  /** Streak length: decides the colors. */
  days: number;
  size?: number;
  /** Still flames (ladder steps) skip the animation. */
  animated?: boolean;
  /** Not yet reached: drawn as a faint outline. */
  dimmed?: boolean;
}

/** Flame that changes color with the streak, breathing slowly with an occasional spark. */
export function Flame({ days, size = 34, animated = true, dimmed = false }: FlameProps) {
  const tier = flameTierIndex(days);
  const colors = flameColors(tier);
  const height = size * 1.25;
  const live = animated && !dimmed;

  // Calm on purpose: one slow breath and a rare spark.
  const body = useSharedValue(1);
  const core = useSharedValue(1);
  const spark = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    body.set(
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.98, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    core.set(
      withRepeat(
        withSequence(
          withTiming(0.94, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.03, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    spark.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
          withDelay(1800, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, [live, body, core, spark]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: body.get() }, { scaleX: 2 - body.get() }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + core.get() * 0.4,
    transform: [{ scaleY: core.get() }],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: spark.get() === 0 ? 0 : (1 - spark.get()) * 0.8,
    transform: [
      { translateY: -spark.get() * size * 0.45 },
      { translateX: spark.get() * size * 0.1 },
      { rotate: `${45 + spark.get() * 90}deg` },
    ],
  }));

  const gradientId = `flame-${tier}${dimmed ? '-dim' : ''}`;

  return (
    <View style={{ width: size, height }} accessibilityElementsHidden>
      <Animated.View style={[styles.layer, live ? bodyStyle : undefined]}>
        <Svg width={size} height={height} viewBox="0 0 64 80">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={colors.from} />
              <Stop offset="1" stopColor={colors.to} />
            </LinearGradient>
          </Defs>
          <Path
            d={OUTER}
            fill={dimmed ? 'none' : `url(#${gradientId})`}
            stroke={dimmed ? colors.from : `url(#${gradientId})`}
            strokeWidth={dimmed ? 4 : ROUND_OUTER}
            strokeLinejoin="round"
            opacity={dimmed ? 0.45 : 1}
          />
        </Svg>
      </Animated.View>

      {dimmed ? null : (
        <Animated.View style={[styles.layer, live ? coreStyle : undefined]}>
          <Svg width={size} height={height} viewBox="0 0 64 80">
            <Path
              d={CORE}
              fill={colors.core}
              stroke={colors.core}
              strokeWidth={ROUND_CORE}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      )}

      {live ? (
        <Animated.View style={[styles.spark, { left: size * 0.68 }, sparkStyle]}>
          <View style={[styles.diamond, { backgroundColor: colors.to }]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  spark: { position: 'absolute', top: 4 },
  diamond: { width: 5, height: 5, borderRadius: 1 },
});
