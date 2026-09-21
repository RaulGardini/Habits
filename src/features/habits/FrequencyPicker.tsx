import { StyleSheet, View } from 'react-native';

import {
  hasWeekday,
  orderedWeekdays,
  toggleWeekday,
  weekdayLong,
  weekdayShort,
} from '@/core/dates/weekdays';
import type { Frequency, FrequencyType, PeriodUnit, WeekStartsOn } from '@/core/habits/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Stepper } from '@/ui/Stepper';

interface FrequencyPickerProps {
  value: Frequency;
  onChange: (frequency: Frequency) => void;
  weekStartsOn: WeekStartsOn;
  error?: string;
}

const TYPE_OPTIONS = [
  { value: 'daily', label: 'Todo dia' },
  { value: 'weekdays', label: 'Dias' },
  { value: 'per_period', label: 'X vezes' },
  { value: 'interval', label: 'Intervalo' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' },
] as const;

/** Default parameters when switching frequency type. */
function defaultFrequency(type: FrequencyType): Frequency {
  switch (type) {
    case 'daily':
      return { type };
    case 'weekdays':
      return { type, days: (1 << 1) | (1 << 3) | (1 << 5) };
    case 'per_period':
      return { type, count: 3, period: 'week' };
    case 'interval':
      return { type, every: 2 };
  }
}

export function FrequencyPicker({ value, onChange, weekStartsOn, error }: FrequencyPickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <SegmentedControl<FrequencyType>
        label="Frequência"
        options={TYPE_OPTIONS}
        value={value.type}
        onChange={(type) => type !== value.type && onChange(defaultFrequency(type))}
      />

      {value.type === 'weekdays' ? (
        <View style={styles.weekdays}>
          {orderedWeekdays(weekStartsOn).map((day) => (
            <Chip
              key={day}
              label={weekdayShort(day)}
              accessibilityLabel={weekdayLong(day)}
              selected={hasWeekday(value.days, day)}
              onPress={() => onChange({ ...value, days: toggleWeekday(value.days, day) })}
            />
          ))}
        </View>
      ) : null}

      {value.type === 'per_period' ? (
        <View style={styles.params}>
          <Stepper
            label="vezes"
            value={value.count}
            min={1}
            max={value.period === 'week' ? 7 : 31}
            suffix={value.count === 1 ? 'vez' : 'vezes'}
            onChange={(count) => onChange({ ...value, count })}
          />
          <SegmentedControl<PeriodUnit>
            label="Período"
            options={PERIOD_OPTIONS}
            value={value.period}
            onChange={(period) =>
              onChange({
                ...value,
                period,
                count: Math.min(value.count, period === 'week' ? 7 : 31),
              })
            }
          />
          <AppText variant="caption" tone="muted">
            Faça em quaisquer dias. A sequência conta{' '}
            {value.period === 'week' ? 'semanas' : 'meses'} em que a meta foi cumprida.
          </AppText>
        </View>
      ) : null}

      {value.type === 'interval' ? (
        <View style={styles.params}>
          <Stepper
            label="intervalo"
            value={value.every}
            min={2}
            max={365}
            suffix="dias"
            onChange={(every) => onChange({ ...value, every })}
          />
          <AppText variant="caption" tone="muted">
            Contado a partir da data de início.
          </AppText>
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
  container: { gap: spacing.sm },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  params: { gap: spacing.sm },
});
