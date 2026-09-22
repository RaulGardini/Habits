import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { hapticSelection } from '@/lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {hideLabel ? null : (
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
      )}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
      >
        {options.map((option) => {
          const selected = option.value === value;
          const foreground = selected ? colors.text : colors.textMuted;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                hapticSelection();
                onChange(option.value);
              }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              style={[
                styles.segment,
                selected && {
                  backgroundColor: colors.surface,
                  boxShadow: `0 1px 3px ${colors.shadow}26`,
                },
              ]}
            >
              {option.icon ? <Icon name={option.icon} size={18} color={foreground} /> : null}
              <AppText variant="label" tone={foreground} numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  track: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
});
