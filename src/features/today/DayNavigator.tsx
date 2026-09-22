import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  addDaysLocal,
  formatDayLabel,
  parseLocalDate,
  type LocalDate,
} from '@/core/dates/localDate';
import { capitalize } from '@/core/format';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';

interface DayNavigatorProps {
  date: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
  /** Shown as the title when viewing today (e.g. "Bom dia"). */
  greeting?: string;
}

/** Friendly header: greeting (or the day) + full date, with a glass pill to change days. */
export function DayNavigator({ date, today, onChange, greeting }: DayNavigatorProps) {
  const { colors } = useTheme();
  const isToday = date === today;
  const title = isToday && greeting ? greeting : capitalize(formatDayLabel(date, today));
  const subtitle = capitalize(format(parseLocalDate(date), "EEEE, d 'de' MMMM", { locale: ptBR }));

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText
          variant="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </AppText>
        <AppText tone="muted">{subtitle}</AppText>
      </View>
      <Glass interactive style={styles.pill}>
        <Pressable
          onPress={() => onChange(addDaysLocal(date, -1))}
          accessibilityRole="button"
          accessibilityLabel="Dia anterior"
          style={styles.button}
        >
          <Icon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        {isToday ? null : (
          <Pressable
            onPress={() => onChange(today)}
            accessibilityRole="button"
            accessibilityLabel="Voltar para hoje"
            style={styles.today}
          >
            <AppText variant="label">Hoje</AppText>
          </Pressable>
        )}
        <Pressable
          onPress={() => onChange(addDaysLocal(date, 1))}
          accessibilityRole="button"
          accessibilityLabel="Próximo dia"
          style={styles.button}
        >
          <Icon name="chevron-right" size={22} color={colors.text} />
        </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center' },
  button: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { minHeight: MIN_TOUCH_SIZE, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
