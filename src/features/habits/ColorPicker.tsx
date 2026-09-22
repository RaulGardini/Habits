import { Pressable, StyleSheet, View } from 'react-native';

import { HABIT_COLORS } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { t } from '@/i18n/i18n';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { scheme, colors } = useTheme();
  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {t('Cor')}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('Cor')} style={styles.row}>
        {HABIT_COLORS.map((color) => {
          const selected = color.key === value;
          const { solid, onSolid } = color[scheme];
          return (
            <Pressable
              key={color.key}
              onPress={() => onChange(color.key)}
              accessibilityRole="radio"
              accessibilityLabel={t(color.label)}
              accessibilityState={{ checked: selected }}
              style={[styles.ring, { borderColor: selected ? colors.text : 'transparent' }]}
            >
              <View style={[styles.swatch, { backgroundColor: solid }]}>
                {selected ? <Icon name="check" size={20} color={onSolid} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ring: {
    width: MIN_TOUCH_SIZE + 4,
    height: MIN_TOUCH_SIZE + 4,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
