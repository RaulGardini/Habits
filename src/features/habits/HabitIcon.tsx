import { StyleSheet, View } from 'react-native';

import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

interface HabitIconProps {
  icon: string;
  color: string;
  size?: number;
}

/** The habit's icon on a filled badge of its color. Decorative. */
export function HabitIcon({ icon, color, size = 40 }: HabitIconProps) {
  const { scheme } = useTheme();
  const { solid, onSolid } = resolveHabitColor(color, scheme);
  return (
    <View
      style={[styles.badge, { width: size, height: size, backgroundColor: solid }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name={icon} size={size * 0.55} color={onSolid} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
