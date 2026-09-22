import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { hapticSelection } from '@/lib/haptics';

interface ToggleRowProps {
  label: string;
  icon?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Label + native switch (brand yellow when on). */
export function ToggleRow({ label, icon, value, onChange }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={20} color={colors.textMuted} /> : null}
      <AppText style={styles.label}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={(next) => {
          hapticSelection();
          onChange(next);
        }}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_SIZE },
  label: { flex: 1 },
});
