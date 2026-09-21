import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/theme/tokens';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** `muted` for secondary text, or any explicit color. */
  tone?: 'default' | 'muted' | (string & {});
}

export function AppText({ variant = 'body', tone = 'default', style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const color = tone === 'default' ? colors.text : tone === 'muted' ? colors.textMuted : tone;
  return <Text {...props} style={[typography[variant], { color }, style]} />;
}
