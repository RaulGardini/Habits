import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { flameTierIndex } from '@/core/habits/perfectStreak';
import { flameColors } from '@/theme/flameColors';

/** Outer flame and inner core, drawn in a 64×80 box. */
const OUTER =
  'M32 2 C 41 18, 56 29, 56 46 C 56 63, 45 76, 32 76 C 19 76, 8 63, 8 46 C 8 33, 18 25, 24 12 C 26 23, 30 25, 32 17 Z';
const CORE =
  'M32 34 C 37 42, 41 47, 41 54 C 41 62, 37 67, 32 67 C 27 67, 23 62, 23 54 C 23 47, 28 42, 32 34 Z';

interface FlameProps {
  /** Streak length: decides the colors. */
  days: number;
  size?: number;
  /** Still flames (ladder steps) skip the flicker. */
  animated?: boolean;
  /** Not yet reached: drawn as a faint outline. */
  dimmed?: boolean;
}

/** Hand-drawn flame that changes color with the streak and flickers gently. */
export function Flame({ days, size = 34, animated = true, dimmed = false }: FlameProps) {
  const tier = flameTierIndex(days);
  const colors = flameColors(tier);
  const height = size * 1.25;

  // Two offset loops: the body breathes, the core pulses a little faster.
  const body = useSharedValue(1);
  const core = useSharedValue(1);
  useEffect(() => {
    if (!animated) return;
    body.set(
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 620, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.97, { duration: 780, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    core.set(
      withRepeat(
        withSequence(
          withTiming(0.86, { duration: 430, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.08, { duration: 510, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [animated, body, core]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: body.get() }, { scaleX: 2 - body.get() }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: dimmed ? 0.5 : 0.2 + core.get() * 0.5,
    transform: [{ scaleY: core.get() }],
  }));

  const gradientId = `flame-${tier}${dimmed ? '-dim' : ''}`;

  return (
    <View style={{ width: size, height }} accessibilityElementsHidden>
      <Animated.View style={[styles.layer, bodyStyle]}>
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
            stroke={dimmed ? colors.from : 'none'}
            strokeWidth={dimmed ? 4 : 0}
            opacity={dimmed ? 0.45 : 1}
          />
        </Svg>
      </Animated.View>
      {dimmed ? null : (
        <Animated.View style={[styles.layer, coreStyle]}>
          <Svg width={size} height={height} viewBox="0 0 64 80">
            <Path d={CORE} fill={colors.core} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
