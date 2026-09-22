import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Native Liquid Glass (iOS 26+). Checked once: some iOS 26 betas crash without the API. */
export const nativeGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

interface GlassProps extends ViewProps {
  /** Glass reacts to touches (buttons, pills). */
  interactive?: boolean;
  /** Tint the glass with the brand color (primary actions). */
  tinted?: boolean;
}

/**
 * Floating chrome (pills, action buttons, bars): Liquid Glass on iOS 26+, a translucent
 * surface elsewhere. Never animate its (or a parent's) opacity to 0 — the glass stops rendering.
 */
export function Glass({ interactive = false, tinted = false, style, ...props }: GlassProps) {
  const { colors, scheme } = useTheme();
  if (nativeGlass) {
    return (
      <GlassView
        {...props}
        glassEffectStyle="regular"
        isInteractive={interactive}
        colorScheme={scheme}
        tintColor={tinted ? colors.primary : undefined}
        style={[styles.base, style]}
      />
    );
  }
  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: tinted ? colors.primary : colors.glass,
          borderColor: tinted ? colors.primary : colors.border,
          boxShadow: `0 4px 16px ${colors.shadow}1f`,
        },
        styles.fallback,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, overflow: 'hidden' },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
