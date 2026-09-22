import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { hapticSelection } from '@/lib/haptics';

interface ChipProps {
  label: string;
  /** Screen-reader label when `label` is abbreviated. */
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  /** Selected background; defaults to the primary color. */
  color?: string;
  onColor?: string;
}

/** Toggleable pill (e.g. weekday selection). */
export function Chip({ label, accessibilityLabel, selected, onPress, color, onColor }: ChipProps) {
  const { colors } = useTheme();
  const background = selected ? (color ?? colors.primary) : colors.surfaceMuted;
  const foreground = selected ? (onColor ?? colors.onPrimary) : colors.text;
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, borderColor: background },
        pressed && { opacity: 0.75 },
      ]}
    >
      <AppText variant="label" tone={foreground}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
