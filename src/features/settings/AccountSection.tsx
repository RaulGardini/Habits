import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { validateCredentials } from '@/core/sync/sync';
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
        A sincronização na nuvem não está disponível nesta versão. Seus dados ficam só neste
        aparelho — use o backup para levá-los a outro.
      </AppText>
    );
  }
  return email ? <SignedIn email={email} /> : <SignInForm />;
}

function SignInForm() {
  const { colors } = useTheme();
  const signIn = useSyncStore((state) => state.signIn);
  const signUp = useSyncStore((state) => state.signUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (mode: 'signIn' | 'signUp') => {
    const invalid = validateCredentials(email, password);
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

  return (
    <View style={styles.container}>
      <AppText tone="muted">
        Opcional: entre para sincronizar hábitos, registros, agenda e metas entre seus aparelhos.
        Sem conta, tudo continua funcionando offline.
      </AppText>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />
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
        <Button label="Entrar" icon="login" onPress={() => run('signIn')} disabled={busy} />
        <Button
          variant="secondary"
          icon="account-plus-outline"
          label="Criar conta"
          onPress={() => run('signUp')}
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
          ? `Última sincronização: ${format(parseISO(lastSyncAt), "d 'de' MMM, HH:mm", { locale: ptBR })}`
          : 'Ainda não sincronizado.';

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sair da conta?',
      message: 'Seus dados continuam neste aparelho, mas deixam de sincronizar.',
      confirmLabel: 'Sair',
    });
    if (ok) await signOut();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Excluir conta?',
      message:
        'Sua conta e todos os dados guardados na nuvem serão apagados permanentemente. Os dados deste aparelho continuam aqui.',
      confirmLabel: 'Excluir conta',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
    } catch (err) {
      showError('Não foi possível excluir a conta.', err);
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
          label="Sincronizar agora"
          onPress={() => void syncNow()}
          disabled={status === 'syncing'}
        />
        <Button variant="secondary" icon="logout" label="Sair" onPress={handleSignOut} />
        <Button
          variant="danger"
          icon="account-remove-outline"
          label="Excluir conta"
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
