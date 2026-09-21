import { Pressable, StyleSheet, View } from 'react-native';

import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

import { HABIT_ICONS } from './habitIcons';

interface IconPickerProps {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, color, onChange }: IconPickerProps) {
  const { colors, scheme } = useTheme();
  const habitColor = resolveHabitColor(color, scheme);
  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        Ícone
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ícone" style={styles.grid}>
        {HABIT_ICONS.map((option) => {
          const selected = option.name === value;
          return (
            <Pressable
              key={option.name}
              onPress={() => onChange(option.name)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              style={[
                styles.cell,
                { borderColor: selected ? habitColor.solid : 'transparent' },
                selected && { backgroundColor: habitColor.soft },
              ]}
            >
              <Icon name={option.name} color={selected ? habitColor.solid : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    width: MIN_TOUCH_SIZE + 4,
    height: MIN_TOUCH_SIZE + 4,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
