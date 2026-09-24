import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BackupError } from '@/core/backup/backup';
import { supportUrl } from '@/lib/links';
import type { WeekStartsOn } from '@/core/habits/types';
import {
  ensurePermission,
  getPermission,
  notificationsSupported,
  type PermissionState,
} from '@/lib/notifications';
import { deleteAllData, exportBackup, importBackup } from '@/stores/dataActions';
import type { Language } from '@/i18n/i18n';
import { useAppLockStore } from '@/stores/appLockStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { rescheduleReminders } from '@/stores/reminders';
import { useSyncStore } from '@/stores/syncStore';
import type { ThemePreference } from '@/theme/tokens';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirm, showError } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';
import { ToggleRow } from '@/ui/ToggleRow';

import { AccountSection } from './AccountSection';
import { CloudBackupSection } from './CloudBackupSection';
import { t } from '@/i18n/i18n';

function THEME_OPTIONS() {
  return [
    { value: 'system', label: t('Sistema'), icon: 'theme-light-dark' },
    { value: 'light', label: t('Claro'), icon: 'white-balance-sunny' },
    { value: 'dark', label: t('Escuro'), icon: 'weather-night' },
  ] as const;
}

function WEEK_START_OPTIONS() {
  return [
    { value: '0', label: t('Domingo') },
    { value: '1', label: t('Segunda') },
  ] as const;
}

/** Settings group: a quiet title above a soft card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </AppText>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

const LANGUAGE_OPTIONS = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
] as const;

export function SettingsScreen() {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const setWeekStartsOn = useSettingsStore((state) => state.setWeekStartsOn);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const syncConfigured = useSyncStore((state) => state.configured);
  const signedIn = useSyncStore((state) => state.userId !== null);

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        {t('Ajustes')}
      </AppText>

      <Section title={t('Aparência')}>
        <SegmentedControl<ThemePreference>
          label={t('Tema')}
          options={THEME_OPTIONS()}
          value={themePreference}
          onChange={(preference) =>
            setThemePreference(preference).catch((error: unknown) =>
              showError(t('Não foi possível salvar o tema.'), error),
            )
          }
        />
      </Section>

      <Section title={t('Idioma')}>
        <SegmentedControl<Language>
          label={t('Idioma do app')}
          options={LANGUAGE_OPTIONS}
          value={language}
          onChange={(next) =>
            setLanguage(next).catch((error: unknown) =>
              showError(t('Não foi possível salvar o idioma.'), error),
            )
          }
        />
      </Section>

      <Section title={t('Seu nome')}>
        <NameField />
      </Section>

      <Section title={t('Calendário')}>
        <SegmentedControl<'0' | '1'>
          label={t('Primeiro dia da semana')}
          options={WEEK_START_OPTIONS()}
          value={String(weekStartsOn) as '0' | '1'}
          onChange={(value) =>
            setWeekStartsOn(Number(value) as WeekStartsOn).catch((error: unknown) =>
              showError(t('Não foi possível salvar a preferência.'), error),
            )
          }
        />
        <AppText variant="caption" tone="muted">
          {t('Usado nos calendários e nos hábitos “X vezes por semana”.')}
        </AppText>
      </Section>

      {syncConfigured ? (
        <Section title={t('Conta e sincronização')}>
          <AccountSection />
        </Section>
      ) : null}

      {signedIn ? (
        <Section title={t('Backups na nuvem')}>
          <CloudBackupSection />
        </Section>
      ) : null}

      <Section title={t('Lembretes')}>
        <NotificationsStatus />
      </Section>

      <AppLockSection />

      <Section title={t('Backup')}>
        <BackupActions />
      </Section>

      <Section title={t('Apagar dados')}>
        <DeleteAllData />
      </Section>

      <Button
        variant="ghost"
        icon="lifebuoy"
        label={t('Ajuda e contato')}
        accessibilityHint={t('Abre a página de suporte no navegador')}
        onPress={() => {
          Linking.openURL(supportUrl()).catch((error: unknown) =>
            showError(t('Não foi possível abrir a página de suporte.'), error),
          );
        }}
      />
      <Button
        variant="ghost"
        icon="shield-lock-outline"
        label={t('Política de privacidade')}
        onPress={() => router.push('/privacy')}
      />
      <AppText variant="caption" tone="muted" style={styles.about}>
        {t('Habits {version} · gratuito e sem anúncios.', {
          version: Constants.expoConfig?.version ?? '',
        })}
      </AppText>
    </Screen>
  );
}

/** Optional first name, used in the greeting on the Today screen. */
function NameField() {
  const saved = useSettingsStore((state) => state.displayName);
  const [name, setName] = useState(saved);
  // Keep the field in sync when another device changes it.
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setName(saved);
  }

  const commit = () => {
    if (name.trim() === saved) return;
    useSettingsStore
      .getState()
      .setDisplayName(name)
      .catch((error: unknown) => showError(t('Não foi possível salvar o nome.'), error));
  };

  return (
    <>
      <TextField
        label={t('Como quer ser chamado?')}
        value={name}
        onChangeText={setName}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={t('Ex: Raul')}
        maxLength={40}
        returnKeyType="done"
      />
      <AppText variant="caption" tone="muted">
        {t('Usado na saudação da tela Hoje. Deixe em branco para não usar nome.')}
      </AppText>
    </>
  );
}

function NotificationsStatus() {
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    getPermission()
      .then(setPermission)
      .catch(() => setPermission('undetermined'));
  }, []);

  if (!notificationsSupported) {
    return (
      <AppText tone="muted">
        {t(
          'Os lembretes são enviados pelo app no Android e no iOS. No navegador você pode configurá-los, mas eles não disparam.',
        )}
      </AppText>
    );
  }

  const request = async () => {
    const granted = await ensurePermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) await rescheduleReminders();
  };

  return (
    <>
      <AppText tone="muted">
        {permission === 'granted'
          ? t('Notificações permitidas. Configure os horários em cada hábito.')
          : permission === 'denied'
            ? t(
                'Notificações bloqueadas. Ative-as nas configurações do sistema para receber lembretes.',
              )
            : t('Permita notificações para receber os lembretes dos seus hábitos.')}
      </AppText>
      {permission === 'undetermined' ? (
        <Button icon="bell-ring-outline" label={t('Permitir notificações')} onPress={request} />
      ) : null}
    </>
  );
}

/** Optional lock with Face ID / fingerprint / passcode (hidden where the device cannot do it). */
function AppLockSection() {
  const available = useAppLockStore((state) => state.available);
  const enabled = useAppLockStore((state) => state.enabled);
  const setEnabled = useAppLockStore((state) => state.setEnabled);
  if (!available) return null;
  return (
    <Section title={t('Privacidade')}>
      <ToggleRow
        label={t('Bloquear o app')}
        icon="shield-lock-outline"
        value={enabled}
        onChange={(next) => {
          setEnabled(next).catch((error: unknown) =>
            showError(t('Não foi possível mudar o bloqueio.'), error),
          );
        }}
      />
      <AppText variant="caption" tone="muted">
        {t(
          'Pede Face ID, digital ou o código do aparelho ao abrir o app e ao voltar depois de 30 s fora dele. Os widgets continuam mostrando seus hábitos na tela inicial.',
        )}
      </AppText>
    </Section>
  );
}

function BackupActions() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const doExport = async () => {
    const ok = await confirm({
      title: t('Exportar backup?'),
      message: t(
        'O arquivo não é criptografado: quem tiver acesso a ele consegue ler seus hábitos, registros e anotações. Guarde-o em um lugar privado e não o envie para outras pessoas.',
      ),
      confirmLabel: t('Exportar'),
    });
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      await exportBackup();
      setResult('Backup exportado.');
    } catch (error) {
      showError(t('Não foi possível exportar o backup.'), error);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const ok = await confirm({
      title: t('Importar backup?'),
      message: t(
        'Os dados do arquivo serão mesclados com os atuais. Quando o mesmo item existir nos dois, fica a versão alterada por último.',
      ),
      confirmLabel: t('Escolher arquivo'),
    });
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      const summary = await importBackup();
      if (summary) {
        // Imported rows were queued for the cloud by the database (sync outbox).
        void useSyncStore.getState().syncNow();
        setResult(
          t('Importação concluída: {inserted} novos, {updated} atualizados, {skipped} ignorados.', {
            inserted: summary.inserted,
            updated: summary.updated,
            skipped: summary.skipped,
          }),
        );
      }
    } catch (error) {
      if (error instanceof BackupError) showError(error.message);
      else showError(t('Não foi possível importar o backup.'), error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppText tone="muted">
        {t(
          'Sem conta, seus dados ficam só neste aparelho. Exporte um backup em JSON regularmente e guarde-o em um lugar privado (Drive, computador) — o arquivo não é criptografado.',
        )}
      </AppText>
      <View style={styles.buttons}>
        <Button
          icon="download-outline"
          label={t('Exportar backup')}
          onPress={doExport}
          disabled={busy}
        />
        <Button
          variant="secondary"
          icon="upload-outline"
          label={t('Importar backup')}
          onPress={doImport}
          disabled={busy}
        />
      </View>
      {result ? (
        <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {result}
        </AppText>
      ) : null}
    </>
  );
}

function DeleteAllData() {
  const signedIn = useSyncStore((state) => state.userId !== null);

  const run = async () => {
    const first = await confirm({
      title: t('Apagar todos os dados?'),
      message: signedIn
        ? t(
            'Hábitos, registros, agenda, metas e ajustes serão apagados deste aparelho E da nuvem (sua conta continua existindo). Recomendamos exportar um backup antes.',
          )
        : t(
            'Hábitos, registros, agenda, metas e ajustes serão apagados deste dispositivo. Recomendamos exportar um backup antes.',
          ),
      confirmLabel: t('Continuar'),
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: t('Tem certeza?'),
      message: t('Esta ação não pode ser desfeita.'),
      confirmLabel: t('Apagar tudo'),
      destructive: true,
    });
    if (!second) return;
    try {
      // Cloud first: otherwise the next sync would bring everything back.
      if (signedIn) await useSyncStore.getState().deleteCloudData();
      await deleteAllData();
    } catch (error) {
      showError(t('Não foi possível apagar os dados.'), error);
    }
  };

  return (
    <>
      <AppText tone="muted">
        {t('Remove permanentemente todos os dados do app neste dispositivo.')}
      </AppText>
      <Button
        variant="danger"
        icon="delete-forever-outline"
        label={t('Apagar todos os dados')}
        onPress={run}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
  buttons: { gap: spacing.sm },
  about: { textAlign: 'center' },
});
