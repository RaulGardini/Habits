import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

interface StatTileProps {
  label: string;
  value: string;
  icon: string;
  /** Icon color (identity); the value stays in text color. */
  color: string;
  hint?: string;
}

/** Hero number with a label — the right form for a single headline figure. */
export function StatTile({ label, value, icon, color, hint }: StatTileProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      <View style={styles.header}>
        <Icon name={icon} size={18} color={color} />
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
          {label}
        </AppText>
      </View>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
