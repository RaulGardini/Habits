import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Habit } from '@/core/habits/types';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

interface HabitCheckRowProps {
  habit: Habit;
  done: boolean;
  /** Future days cannot be checked. */
  disabled: boolean;
  onToggle: () => void;
}

const CHECK_SIZE = 32;

export function HabitCheckRow({ habit, done, disabled, onToggle }: HabitCheckRowProps) {
  const { colors, scheme } = useTheme();
  const habitColor = resolveHabitColor(habit.color, scheme);
  const scale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handlePress = () => {
    if (done) {
      hapticLight();
    } else {
      hapticSuccess();
      scale.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1)));
    }
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={habit.name}
      accessibilityState={{ checked: done, disabled }}
      accessibilityHint={disabled ? 'Não é possível marcar dias futuros' : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: done ? habitColor.soft : colors.surface,
          borderColor: done ? habitColor.solid : colors.border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <HabitIcon icon={habit.icon} color={habit.color} />
      <AppText variant="bodyStrong" numberOfLines={2} style={styles.name}>
        {habit.name}
      </AppText>
      <Animated.View style={checkStyle}>
        <View
          style={[
            styles.check,
            { borderColor: habitColor.solid },
            done && { backgroundColor: habitColor.solid },
          ]}
        >
          {done ? <Icon name="check-bold" size={20} color={habitColor.onSolid} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE + 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  name: { flex: 1 },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: radius.full,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
