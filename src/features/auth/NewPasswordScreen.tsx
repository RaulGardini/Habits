import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MIN_PASSWORD_LENGTH } from '@/core/auth/auth';
import { t } from '@/i18n/i18n';
import { hapticSuccess } from '@/lib/haptics';
import { useSyncStore } from '@/stores/syncStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';

/** New password: after a reset link, or "Alterar senha" in Settings. Needs a session. */
export function NewPasswordScreen() {
  const { colors } = useTheme();
  const email = useSyncStore((state) => state.email);
  const updatePassword = useSyncStore((state) => state.updatePassword);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!email) {
    return (
      <Screen>
        <View style={styles.container}>
          <AppText tone="muted">
            {t('O link expirou ou você não está conectado. Peça um novo link em Ajustes.')}
          </AppText>
          <Button label={t('Ir para os ajustes')} onPress={() => router.replace('/settings')} />
        </View>
      </Screen>
    );
  }

  const save = async () => {
    if (password !== repeat) {
      setError(t('As senhas não são iguais.'));
      return;
    }
    setBusy(true);
    setError(null);
    const problem = await updatePassword(password);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    hapticSuccess();
    setDone(true);
  };

  return (
    <Screen>
      <View style={styles.container}>
        {done ? (
          <>
            <AppText variant="heading" accessibilityRole="header">
              {t('Senha alterada')}
            </AppText>
            <AppText tone="muted">{t('Use a nova senha da próxima vez que entrar.')}</AppText>
            <Button label={t('Continuar')} onPress={() => router.replace('/settings')} />
          </>
        ) : (
          <>
            <AppText tone="muted">{t('Conta: {email}', { email })}</AppText>
            <TextField
              label={t('Nova senha')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TextField
              label={t('Repita a nova senha')}
              value={repeat}
              onChangeText={setRepeat}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <AppText
              variant="caption"
              tone={error ? colors.danger : 'muted'}
              accessibilityLiveRegion="polite"
            >
              {error ??
                t(
                  'Mínimo de {count} caracteres. Senhas que já vazaram na internet não são aceitas.',
                  { count: MIN_PASSWORD_LENGTH },
                )}
            </AppText>
            <Button
              label={t('Salvar nova senha')}
              icon="lock-reset"
              onPress={save}
              disabled={busy}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingTop: spacing.md },
});
