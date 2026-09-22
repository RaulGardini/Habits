import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Glass } from './Glass';
import { Icon } from './Icon';

interface GlassAddButtonProps {
  /** Screen-reader label, e.g. "Novo hábito". */
  label: string;
  onPress: () => void;
  icon?: string;
}

/** Round brand-tinted action button that floats over the content (Liquid Glass on iOS 26). */
export function GlassAddButton({ label, onPress, icon = 'plus' }: GlassAddButtonProps) {
  const { colors } = useTheme();
  return (
    <Glass interactive tinted style={styles.button}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pressable}
      >
        <Icon name={icon} size={26} color={colors.onPrimary} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  button: { width: 52, height: 52 },
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
