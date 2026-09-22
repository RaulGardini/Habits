import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDayLabel, type LocalDate } from '@/core/dates/localDate';
import { periodRange, shiftPeriod } from '@/core/dates/periods';
import { capitalize } from '@/core/format';
import { useToday } from '@/hooks/useNow';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';

import { monthLabel } from './format';
import { MonthGrid } from './MonthGrid';
import { t } from '@/i18n/i18n';

interface DatePickerFieldProps {
  label: string;
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  minDate?: LocalDate;
  error?: string;
}

/** Date input with an inline month calendar (works the same on web and native). */
export function DatePickerField({ label, value, onChange, minDate, error }: DatePickerFieldProps) {
  const { colors } = useTheme();
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value);
  const text = capitalize(formatDayLabel(value, today));

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <Pressable
        onPress={() => {
          setMonth(value);
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityState={{ expanded: open }}
        style={[styles.field, { backgroundColor: colors.surfaceMuted }]}
      >
        <Icon name="calendar-blank-outline" size={20} color={colors.textMuted} />
        <AppText style={styles.flex}>{text}</AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={[styles.picker, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.monthRow}>
            <IconButton
              icon="chevron-left"
              label={t('Mês anterior')}
              onPress={() => setMonth(shiftPeriod(month, 'month', -1))}
            />
            <AppText variant="bodyStrong" style={styles.monthLabel}>
              {capitalize(monthLabel(month))}
            </AppText>
            <IconButton
              icon="chevron-right"
              label={t('Próximo mês')}
              onPress={() => setMonth(shiftPeriod(month, 'month', 1))}
            />
          </View>
          <MonthGrid
            range={periodRange(month, 'month', weekStartsOn)}
            today={today}
            selected={value}
            weekStartsOn={weekStartsOn}
            minDate={minDate}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
      {error ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
  picker: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthLabel: { flex: 1, textAlign: 'center' },
});
