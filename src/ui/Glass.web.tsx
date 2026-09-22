import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export const nativeGlass = false;

interface GlassProps extends ViewProps {
  interactive?: boolean;
  tinted?: boolean;
}

/** Web version of `Glass`: frosted translucent surface (backdrop blur + light rim). */
export function Glass({ interactive: _interactive, tinted = false, style, ...props }: GlassProps) {
  const { colors, scheme } = useTheme();
  const rim = scheme === 'dark' ? '#ffffff1f' : '#ffffffb3';
  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: tinted ? `${colors.primary}e6` : colors.glass,
          borderColor: rim,
          boxShadow: `0 8px 24px ${colors.shadow}24, inset 0 1px 0 ${rim}`,
          // react-native-web passes these through to CSS.
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        } as object,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, overflow: 'hidden', borderWidth: 1 },
});
