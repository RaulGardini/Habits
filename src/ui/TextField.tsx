import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...props }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          typography.body,
          props.multiline && styles.multiline,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  input: {
    minHeight: MIN_TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
