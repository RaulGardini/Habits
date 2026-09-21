import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius } from '@/theme/tokens';

import { Icon } from './Icon';

interface IconButtonProps {
  icon: string;
  /** Required: icon-only buttons need a screen-reader label. */
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  size?: number;
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
  disabled = false,
  size = 24,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: colors.surfaceMuted },
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
});
