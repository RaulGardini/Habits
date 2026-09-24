import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';

import { HABIT_ICON_GROUPS } from './habitIcons';
import { t } from '@/i18n/i18n';

interface IconPickerProps {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}

/** Icons by group: a row of group chips, then the icons of the chosen group. */
export function IconPicker({ value, color, onChange }: IconPickerProps) {
  const { colors, scheme } = useTheme();
  const habitColor = resolveHabitColor(color, scheme);
  // Start on the group of the current icon.
  const [groupIndex, setGroupIndex] = useState(() =>
    Math.max(
      0,
      HABIT_ICON_GROUPS.findIndex((g) => g.icons.some((icon) => icon.name === value)),
    ),
  );
  const group = HABIT_ICON_GROUPS[groupIndex] ?? HABIT_ICON_GROUPS[0];

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {t('Ícone')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groups}
        accessibilityLabel={t('Grupos de ícones')}
      >
        {HABIT_ICON_GROUPS.map((g, index) => (
          <Chip
            key={g.title}
            label={t(g.title)}
            selected={index === groupIndex}
            onPress={() => setGroupIndex(index)}
          />
        ))}
      </ScrollView>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('Ícones: {group}', { group: group?.title ?? '' })}
        style={styles.grid}
      >
        {group?.icons.map((option) => {
          const selected = option.name === value;
          return (
            <Pressable
              key={option.name}
              onPress={() => onChange(option.name)}
              accessibilityRole="radio"
              accessibilityLabel={t(option.label)}
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
  container: { gap: spacing.sm },
  groups: { gap: spacing.xs, paddingRight: spacing.lg },
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
