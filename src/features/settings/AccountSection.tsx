import { parseISO } from 'date-fns';
import { formatWith, t } from '@/i18n/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MIN_PASSWORD_LENGTH, validateEmail, validateSignIn } from '@/core/auth/auth';
import { useSyncStore } from '@/stores/syncStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { confirm, showError } from '@/ui/dialogs';
import { TextField } from '@/ui/TextField';

/** Optional account + cloud sync. Hidden functionality when the build has no Supabase config. */
export function AccountSection() {
  const configured = useSyncStore((state) => state.configured);
  const email = useSyncStore((state) => state.email);

  if (!configured) {
    return (
      <AppText tone="muted">
        {t(
          'A sincronização na nuvem não está disponível nesta versão. Seus dados ficam só neste aparelho — use o backup para levá-los a outro.',
        )}
      </AppText>
    );
  }
  return email ? <SignedIn email={email} /> : <SignInForm />;
}

function SignInForm() {
  const { colors } = useTheme();
  const signIn = useSyncStore((state) => state.signIn);
  const signUp = useSyncStore((state) => state.signUp);
  const requestPasswordReset = useSyncStore((state) => state.requestPasswordReset);
  const notice = useSyncStore((state) => state.notice);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (mode: 'signIn' | 'signUp') => {
    // New passwords are checked by the store (rules + known leaks).
    const invalid = mode === 'signIn' ? validateSignIn(email, password) : validateEmail(email);
    if (invalid) {
      setMessage({ text: invalid, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await (mode === 'signIn' ? signIn(email, password) : signUp(email, password));
    setBusy(false);
    if (result === 'confirm') {
      setMessage({
        text: 'Conta criada! Abra o link enviado para o seu e-mail e depois entre aqui.',
        error: false,
      });
    } else if (result) {
      setMessage({ text: result, error: true });
    }
  };

  const forgotPassword = async () => {
    const invalid = validateEmail(email);
    if (invalid) {
      setMessage({ text: t('Digite seu e-mail acima para receber o link.'), error: true });
      return;
    }
    setBusy(true);
    setMessage(await requestPasswordReset(email));
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <AppText tone="muted">
        {t(
          'Opcional: entre para sincronizar hábitos, registros, agenda e metas entre seus aparelhos. Sem conta, tudo continua funcionando offline.',
        )}
      </AppText>
      <TextField
        label={t('E-mail')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label={t('Senha')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />
      <AppText variant="caption" tone="muted">
        {t('Para criar conta: mínimo de {count} caracteres.', { count: MIN_PASSWORD_LENGTH })}
      </AppText>
      {notice && !message ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}
      {message ? (
        <AppText
          variant="caption"
          tone={message.error ? colors.danger : 'muted'}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </AppText>
      ) : null}
      <View style={styles.buttons}>
        <Button label={t('Entrar')} icon="login" onPress={() => run('signIn')} disabled={busy} />
        <Button
          variant="secondary"
          icon="account-plus-outline"
          label={t('Criar conta')}
          onPress={() => run('signUp')}
          disabled={busy}
        />
        <Button
          variant="ghost"
          icon="lock-question"
          label={t('Esqueci minha senha')}
          onPress={forgotPassword}
          disabled={busy}
        />
      </View>
    </View>
  );
}

function SignedIn({ email }: { email: string }) {
  const { colors } = useTheme();
  const status = useSyncStore((state) => state.status);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const error = useSyncStore((state) => state.error);
  const syncNow = useSyncStore((state) => state.syncNow);
  const signOut = useSyncStore((state) => state.signOut);
  const deleteAccount = useSyncStore((state) => state.deleteAccount);

  const statusText =
    status === 'syncing'
      ? 'Sincronizando…'
      : status === 'error'
        ? (error ?? 'Falha na sincronização.')
        : lastSyncAt
          ? t('Última sincronização: {date}', {
              date: formatWith(parseISO(lastSyncAt), "d 'de' MMM, HH:mm", 'MMM d, HH:mm'),
            })
          : t('Ainda não sincronizado.');

  const handleSignOut = async () => {
    const ok = await confirm({
      title: t('Sair da conta?'),
      message: t(
        'Os dados desta conta serão apagados deste aparelho. Eles continuam na nuvem e voltam quando você entrar de novo.',
      ),
      confirmLabel: t('Sair'),
    });
    if (!ok) return;
    try {
      const result = await signOut();
      if (!result) return;
      // Some changes could not be sent (offline?): losing them needs a second yes.
      const discard = await confirm({
        title: t('Alterações não enviadas'),
        message: t(
          '{count} alterações ainda não chegaram à nuvem e serão perdidas se você sair agora. Conecte-se à internet e tente de novo, ou saia mesmo assim.',
          { count: result.pending },
        ),
        confirmLabel: t('Sair e perder'),
        destructive: true,
      });
      if (discard) await signOut({ discardPending: true });
    } catch (err) {
      showError(t('Não foi possível sair da conta.'), err);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('Excluir conta?'),
      message:
        'Sua conta e todos os dados guardados na nuvem serão apagados permanentemente. Os dados deste aparelho continuam aqui.',
      confirmLabel: t('Excluir conta'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
    } catch (err) {
      showError(t('Não foi possível excluir a conta.'), err);
    }
  };

  return (
    <View style={styles.container}>
      <AppText>
        Conectado como <AppText variant="bodyStrong">{email}</AppText>
      </AppText>
      <AppText
        variant="caption"
        tone={status === 'error' ? colors.danger : 'muted'}
        accessibilityLiveRegion="polite"
      >
        {statusText}
      </AppText>
      <View style={styles.buttons}>
        <Button
          icon="sync"
          label={t('Sincronizar agora')}
          onPress={() => void syncNow()}
          disabled={status === 'syncing'}
        />
        <Button
          variant="secondary"
          icon="lock-reset"
          label={t('Alterar senha')}
          onPress={() => router.push('/auth/new-password')}
        />
        <Button variant="secondary" icon="logout" label={t('Sair')} onPress={handleSignOut} />
        <Button
          variant="danger"
          icon="account-remove-outline"
          label={t('Excluir conta')}
          onPress={handleDelete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  buttons: { gap: spacing.sm },
});
