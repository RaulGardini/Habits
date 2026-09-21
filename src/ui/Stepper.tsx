import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Text shown next to the value, e.g. "dias". */
  suffix?: string;
}

/** Integer input with − / + buttons. */
export function Stepper({ label, value, min, max, onChange, suffix }: StepperProps) {
  const { colors } = useTheme();
  const text = suffix ? `${value} ${suffix}` : String(value);
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <IconButton
        icon="minus"
        label={`Diminuir ${label}`}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      />
      <AppText
        variant="bodyStrong"
        style={styles.value}
        accessibilityLabel={`${label}: ${text}`}
        accessibilityLiveRegion="polite"
      >
        {text}
      </AppText>
      <IconButton
        icon="plus"
        label={`Aumentar ${label}`}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
  },
  value: { flex: 1, textAlign: 'center' },
});
