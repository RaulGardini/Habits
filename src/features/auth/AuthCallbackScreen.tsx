import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { t } from '@/i18n/i18n';
import { useSyncStore } from '@/stores/syncStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

/** A link code can be exchanged only once (effects may run twice in development). */
const handled = new Map<
  string,
  ReturnType<ReturnType<typeof useSyncStore.getState>['completeAuthLink']>
>();

/**
 * Where e-mail links land (account confirmation, password reset — see `authRedirectUrl`).
 * Exchanges the one-time code for a session, or explains why the link no longer works.
 */
export function AuthCallbackScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();
  const completeAuthLink = useSyncStore((state) => state.completeAuthLink);
  const [result, setResult] = useState<{ error: string } | { next: 'confirm' } | null>(null);

  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  ).toString();
  // Errors may also come in the #fragment, which only the web can read.
  const hash = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';
  const url = `auth/callback?${query}${hash}`;

  useEffect(() => {
    let promise = handled.get(url);
    if (!promise) {
      promise = completeAuthLink(url);
      handled.set(url, promise);
    }
    let active = true;
    promise
      .then((outcome) => {
        if (!active) return;
        if ('next' in outcome && outcome.next === 'reset') router.replace('/auth/new-password');
        else setResult('error' in outcome ? outcome : { next: 'confirm' });
      })
      .catch(
        () => active && setResult({ error: t('Não foi possível validar o link. Peça um novo.') }),
      );
    return () => {
      active = false;
    };
  }, [url, completeAuthLink]);

  return (
    <Screen>
      <View style={styles.container}>
        {result === null ? (
          <>
            <ActivityIndicator color={colors.accent} />
            <AppText tone="muted">{t('Validando o link…')}</AppText>
          </>
        ) : 'error' in result ? (
          <>
            <AppText variant="heading" accessibilityRole="header">
              {t('Link inválido')}
            </AppText>
            <AppText tone="muted">{result.error}</AppText>
            <Button label={t('Ir para os ajustes')} onPress={() => router.replace('/settings')} />
          </>
        ) : (
          <>
            <AppText variant="heading" accessibilityRole="header">
              {t('E-mail confirmado!')}
            </AppText>
            <AppText tone="muted">
              {t('Você já está conectado e seus dados vão sincronizar.')}
            </AppText>
            <Button label={t('Continuar')} onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingTop: spacing.xl },
});
