import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseLocalDate, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { periodRange, shiftPeriod, type DateRange } from '@/core/dates/periods';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { IconButton } from '@/ui/IconButton';
import { SegmentedControl } from '@/ui/SegmentedControl';

import type { HeatmapMode } from './Heatmap';

const MODE_OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
] as const;

/** "15 – 21 de set.", "setembro de 2026", "2026". */
export function formatRange(range: DateRange, mode: HeatmapMode): string {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  switch (mode) {
    case 'week':
      return from.getMonth() === to.getMonth()
        ? `${format(from, 'd')} – ${format(to, "d 'de' MMM", { locale: ptBR })}`
        : `${format(from, "d 'de' MMM", { locale: ptBR })} – ${format(to, "d 'de' MMM", { locale: ptBR })}`;
    case 'month':
      return format(from, "MMMM 'de' yyyy", { locale: ptBR });
    case 'year':
      return format(from, 'yyyy');
  }
}

export interface StatsPeriod {
  mode: HeatmapMode;
  setMode: (mode: HeatmapMode) => void;
  range: DateRange;
  shift: (amount: number) => void;
  /** Whether the range contains today (next is disabled). */
  isCurrent: boolean;
}

export function useStatsPeriod(initialMode: HeatmapMode = 'month'): StatsPeriod {
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const [mode, setMode] = useState<HeatmapMode>(initialMode);
  const [anchor, setAnchor] = useState<LocalDate>(() => todayLocal());
  const range = useMemo(
    () => periodRange(anchor, mode, weekStartsOn),
    [anchor, mode, weekStartsOn],
  );
  const today = todayLocal();
  return {
    mode,
    setMode,
    range,
    shift: (amount) => setAnchor((current) => shiftPeriod(current, mode, amount)),
    isCurrent: range.from <= today && today <= range.to,
  };
}

export function PeriodHeader({ period }: { period: StatsPeriod }) {
  const label = formatRange(period.range, period.mode);
  return (
    <View style={styles.container}>
      <SegmentedControl<HeatmapMode>
        label="Período"
        options={MODE_OPTIONS}
        value={period.mode}
        onChange={period.setMode}
      />
      <View style={styles.row}>
        <IconButton icon="chevron-left" label="Período anterior" onPress={() => period.shift(-1)} />
        <AppText
          variant="heading"
          style={styles.label}
          accessibilityLiveRegion="polite"
          accessibilityRole="header"
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </AppText>
        <IconButton
          icon="chevron-right"
          label="Próximo período"
          onPress={() => period.shift(1)}
          disabled={period.isCurrent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, textAlign: 'center' },
});
