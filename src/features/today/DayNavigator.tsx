import { StyleSheet, View } from 'react-native';

import { addDaysLocal, formatDayLabel, type LocalDate } from '@/core/dates/localDate';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

interface DayNavigatorProps {
  date: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
}

export function DayNavigator({ date, today, onChange }: DayNavigatorProps) {
  const label = formatDayLabel(date, today);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <IconButton
          icon="chevron-left"
          label="Dia anterior"
          onPress={() => onChange(addDaysLocal(date, -1))}
        />
        <AppText
          variant="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.label}
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </AppText>
        <IconButton
          icon="chevron-right"
          label="Próximo dia"
          onPress={() => onChange(addDaysLocal(date, 1))}
        />
      </View>
      {date !== today ? (
        <Button
          variant="ghost"
          icon="calendar-today"
          label="Voltar para hoje"
          onPress={() => onChange(today)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, textAlign: 'center' },
});
