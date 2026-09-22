import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackupError } from '@/core/backup/backup';
import type { WeekStartsOn } from '@/core/habits/types';
import {
  ensurePermission,
  getPermission,
  notificationsSupported,
  type PermissionState,
} from '@/lib/notifications';
import { deleteAllData, exportBackup, importBackup } from '@/stores/dataActions';
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

import { AccountSection } from './AccountSection';

const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema', icon: 'theme-light-dark' },
  { value: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Escuro', icon: 'weather-night' },
] as const;

const WEEK_START_OPTIONS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
] as const;

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

export function SettingsScreen() {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const setWeekStartsOn = useSettingsStore((state) => state.setWeekStartsOn);
  const syncConfigured = useSyncStore((state) => state.configured);

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Ajustes
      </AppText>

      <Section title="Aparência">
        <SegmentedControl<ThemePreference>
          label="Tema"
          options={THEME_OPTIONS}
          value={themePreference}
          onChange={(preference) =>
            setThemePreference(preference).catch((error: unknown) =>
              showError('Não foi possível salvar o tema.', error),
            )
          }
        />
      </Section>

      <Section title="Calendário">
        <SegmentedControl<'0' | '1'>
          label="Primeiro dia da semana"
          options={WEEK_START_OPTIONS}
          value={String(weekStartsOn) as '0' | '1'}
          onChange={(value) =>
            setWeekStartsOn(Number(value) as WeekStartsOn).catch((error: unknown) =>
              showError('Não foi possível salvar a preferência.', error),
            )
          }
        />
        <AppText variant="caption" tone="muted">
          Usado nos calendários e nos hábitos &quot;X vezes por semana&quot;.
        </AppText>
      </Section>

      {syncConfigured ? (
        <Section title="Conta e sincronização">
          <AccountSection />
        </Section>
      ) : null}

      <Section title="Lembretes">
        <NotificationsStatus />
      </Section>

      <Section title="Backup">
        <BackupActions />
      </Section>

      <Section title="Apagar dados">
        <DeleteAllData />
      </Section>

      <Button
        variant="ghost"
        icon="shield-lock-outline"
        label="Política de privacidade"
        onPress={() => router.push('/privacy')}
      />
      <AppText variant="caption" tone="muted" style={styles.about}>
        Habits {Constants.expoConfig?.version ?? ''} · gratuito e sem anúncios.
      </AppText>
    </Screen>
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
        Os lembretes são enviados pelo app no Android e no iOS. No navegador você pode
        configurá-los, mas eles não disparam.
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
          ? 'Notificações permitidas. Configure os horários em cada hábito.'
          : permission === 'denied'
            ? 'Notificações bloqueadas. Ative-as nas configurações do sistema para receber lembretes.'
            : 'Permita notificações para receber os lembretes dos seus hábitos.'}
      </AppText>
      {permission === 'undetermined' ? (
        <Button icon="bell-ring-outline" label="Permitir notificações" onPress={request} />
      ) : null}
    </>
  );
}

function BackupActions() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const doExport = async () => {
    setBusy(true);
    setResult(null);
    try {
      await exportBackup();
      setResult('Backup exportado.');
    } catch (error) {
      showError('Não foi possível exportar o backup.', error);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const ok = await confirm({
      title: 'Importar backup?',
      message:
        'Os dados do arquivo serão mesclados com os atuais. Quando o mesmo item existir nos dois, fica a versão alterada por último.',
      confirmLabel: 'Escolher arquivo',
    });
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      const summary = await importBackup();
      if (summary) {
        // Imported rows may be older than the last push: send everything on the next sync.
        const sync = useSyncStore.getState();
        if (sync.userId) {
          await sync.requestFullSync();
          void sync.syncNow();
        }
        setResult(
          `Importação concluída: ${summary.inserted} novos, ${summary.updated} atualizados, ${summary.skipped} ignorados.`,
        );
      }
    } catch (error) {
      if (error instanceof BackupError) showError(error.message);
      else showError('Não foi possível importar o backup.', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppText tone="muted">
        Sem conta, seus dados ficam só neste aparelho. Exporte um backup em JSON regularmente e
        guarde-o em um lugar seguro (Drive, e-mail, computador).
      </AppText>
      <View style={styles.buttons}>
        <Button
          icon="download-outline"
          label="Exportar backup"
          onPress={doExport}
          disabled={busy}
        />
        <Button
          variant="secondary"
          icon="upload-outline"
          label="Importar backup"
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
      title: 'Apagar todos os dados?',
      message: signedIn
        ? 'Hábitos, registros, tarefas, eventos, notas, metas e ajustes serão apagados deste aparelho E da nuvem (sua conta continua existindo). Recomendamos exportar um backup antes.'
        : 'Hábitos, registros, tarefas, eventos, notas, metas e ajustes serão apagados deste dispositivo. Recomendamos exportar um backup antes.',
      confirmLabel: 'Continuar',
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Tem certeza?',
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar tudo',
      destructive: true,
    });
    if (!second) return;
    try {
      // Cloud first: otherwise the next sync would bring everything back.
      if (signedIn) await useSyncStore.getState().deleteCloudData();
      await deleteAllData();
    } catch (error) {
      showError('Não foi possível apagar os dados.', error);
    }
  };

  return (
    <>
      <AppText tone="muted">
        Remove permanentemente todos os dados do app neste dispositivo.
      </AppText>
      <Button
        variant="danger"
        icon="delete-forever-outline"
        label="Apagar todos os dados"
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
