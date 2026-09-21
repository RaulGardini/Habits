import { StyleSheet, View } from 'react-native';

import { addDaysLocal, formatShortDate, type LocalDate } from '@/core/dates/localDate';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

interface DateStepperProps {
  label: string;
  value: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
  error?: string;
}

/** Simple cross-platform date input (native date pickers do not work on web). */
export function DateStepper({ label, value, today, onChange, error }: DateStepperProps) {
  const { colors } = useTheme();
  const formatted = formatShortDate(value);
  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconButton
          icon="chevron-left"
          label="Dia anterior"
          onPress={() => onChange(addDaysLocal(value, -1))}
        />
        <AppText
          variant="bodyStrong"
          style={styles.value}
          accessibilityLabel={`${label}: ${formatted}`}
          accessibilityLiveRegion="polite"
        >
          {formatted}
        </AppText>
        <IconButton
          icon="chevron-right"
          label="Próximo dia"
          onPress={() => onChange(addDaysLocal(value, 1))}
        />
      </View>
      {value !== today ? (
        <Button variant="ghost" label="Usar hoje" onPress={() => onChange(today)} />
      ) : null}
      {error ? (
        <AppText variant="caption" tone={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
  },
  value: { flex: 1, textAlign: 'center' },
});
