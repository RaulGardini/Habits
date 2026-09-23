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
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { flameTierIndex } from '@/core/habits/perfectStreak';
import { flameColors } from '@/theme/flameColors';

/** Plump, rounded flame (Duolingo-ish) plus its lighter core, drawn in a 64×80 box. */
const OUTER =
  'M32 4 C 41 15, 55 25, 57 40 C 59 57, 47 74, 32 77 C 17 74, 5 57, 7 40 C 9 25, 23 15, 32 4 Z';
const CORE =
  'M32 32 C 38 41, 45 48, 45 57 C 45 67, 39 73, 32 73 C 25 73, 19 67, 19 57 C 19 48, 26 41, 32 32 Z';

interface FlameProps {
  /** Streak length: decides the colors. */
  days: number;
  size?: number;
  /** Still flames (ladder steps) skip the flicker. */
  animated?: boolean;
  /** Not yet reached: drawn as a faint outline. */
  dimmed?: boolean;
}

/** Animated flame that changes color with the streak: it breathes, sways and throws sparks. */
export function Flame({ days, size = 34, animated = true, dimmed = false }: FlameProps) {
  const tier = flameTierIndex(days);
  const colors = flameColors(tier);
  const height = size * 1.25;
  const live = animated && !dimmed;

  // Independent loops with different periods, so the movement never looks mechanical.
  const body = useSharedValue(1);
  const sway = useSharedValue(0);
  const core = useSharedValue(1);
  const halo = useSharedValue(0.5);
  const sparkA = useSharedValue(0);
  const sparkB = useSharedValue(0);

  useEffect(() => {
    if (!live) return;
    const loop = (value: number, up: number, upMs: number, down: number, downMs: number) =>
      withRepeat(
        withSequence(
          withTiming(up, { duration: upMs, easing: Easing.inOut(Easing.quad) }),
          withTiming(down, { duration: downMs, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    body.set(loop(1, 1.08, 560, 0.95, 720));
    sway.set(loop(0, 3.5, 900, -3.5, 900));
    core.set(loop(1, 0.84, 380, 1.1, 460));
    halo.set(loop(0.5, 1, 700, 0.45, 900));
    const spark = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
          false,
        ),
      );
    sparkA.set(spark(0));
    sparkB.set(spark(600));
  }, [live, body, sway, core, halo, sparkA, sparkB]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - body.get()) * size * 0.06 },
      { scaleY: body.get() },
      { scaleX: 2 - body.get() },
      { rotate: `${sway.get()}deg` },
    ],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + core.get() * 0.5,
    transform: [{ scaleY: core.get() }, { scaleX: 2 - core.get() }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() }));
  const sparkAStyle = useAnimatedStyle(() => ({
    opacity: sparkA.get() === 0 ? 0 : (1 - sparkA.get()) * 0.9,
    transform: [
      { translateY: -sparkA.get() * size * 0.55 },
      { translateX: sparkA.get() * size * 0.12 },
      { scale: 1 - sparkA.get() * 0.5 },
    ],
  }));
  const sparkBStyle = useAnimatedStyle(() => ({
    opacity: sparkB.get() === 0 ? 0 : (1 - sparkB.get()) * 0.9,
    transform: [
      { translateY: -sparkB.get() * size * 0.55 },
      { translateX: -sparkB.get() * size * 0.1 },
      { scale: 1 - sparkB.get() * 0.5 },
    ],
  }));

  const gradientId = `flame-${tier}${dimmed ? '-dim' : ''}`;
  const haloId = `halo-${tier}`;

  return (
    <View style={{ width: size, height }} accessibilityElementsHidden>
      {live ? (
        <Animated.View style={[styles.layer, haloStyle]}>
          <Svg width={size} height={height} viewBox="0 0 64 80">
            <Defs>
              <RadialGradient id={haloId} cx="50%" cy="60%" r="50%">
                <Stop offset="0" stopColor={colors.to} stopOpacity="0.45" />
                <Stop offset="1" stopColor={colors.to} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="32" cy="48" r="32" fill={`url(#${haloId})`} />
          </Svg>
        </Animated.View>
      ) : null}

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
            stroke={dimmed ? colors.from : 'none'}
            strokeWidth={dimmed ? 4 : 0}
            strokeLinejoin="round"
            opacity={dimmed ? 0.45 : 1}
          />
        </Svg>
      </Animated.View>

      {dimmed ? null : (
        <Animated.View style={[styles.layer, live ? coreStyle : undefined]}>
          <Svg width={size} height={height} viewBox="0 0 64 80">
            <Path d={CORE} fill={colors.core} />
          </Svg>
        </Animated.View>
      )}

      {live ? (
        <>
          <Animated.View style={[styles.spark, { left: size * 0.62 }, sparkAStyle]}>
            <View style={[styles.dot, { backgroundColor: colors.to }]} />
          </Animated.View>
          <Animated.View style={[styles.spark, { left: size * 0.28 }, sparkBStyle]}>
            <View style={[styles.dotSmall, { backgroundColor: colors.core }]} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  spark: { position: 'absolute', top: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotSmall: { width: 3, height: 3, borderRadius: 1.5 },
});
