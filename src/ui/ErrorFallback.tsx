import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n/i18n';
import { logError } from '@/lib/log';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

/**
 * Shown in place of a screen that crashed while rendering (`screenErrorBoundary` in the root
 * layout): the rest of the app keeps working and the screen can be rendered again.
 */
export function ScreenErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  useEffect(() => logError('Screen crashed', error), [error]);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <EmptyState
        icon="alert-circle-outline"
        title={t('Algo deu errado')}
        description={
          __DEV__ ? error.message : t('Esta tela teve um problema. Seus dados continuam salvos.')
        }
        action={<Button label={t('Tentar de novo')} icon="refresh" onPress={() => void retry()} />}
      />
    </View>
  );
}

/** Last resort for errors outside any screen (root layout); brings its own theme. */
export function AppErrorFallback(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <ScreenErrorFallback {...props} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
