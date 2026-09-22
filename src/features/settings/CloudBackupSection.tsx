import { formatWith, t } from '@/i18n/i18n';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CLOUD_BACKUP_INTERVAL_DAYS,
  CLOUD_BACKUPS_KEPT,
  type CloudBackupInfo,
} from '@/core/backup/cloudBackup';
import { useCloudBackupStore } from '@/stores/cloudBackupStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { confirm, showError } from '@/ui/dialogs';

const when = (backup: CloudBackupInfo) =>
  formatWith(new Date(backup.createdAt), "d 'de' MMM 'às' HH:mm", "MMM d 'at' HH:mm");

/** Weekly automatic snapshots in the cloud, with manual backup and restore. Signed-in only. */
export function CloudBackupSection() {
  const { colors } = useTheme();
  const backups = useCloudBackupStore((state) => state.backups);
  const busy = useCloudBackupStore((state) => state.busy);
  const error = useCloudBackupStore((state) => state.error);

  useEffect(() => {
    void useCloudBackupStore.getState().refresh();
  }, []);

  const backupNow = () =>
    useCloudBackupStore
      .getState()
      .backupNow()
      .catch(() => {});

  const restore = async (backup: CloudBackupInfo) => {
    const ok = await confirm({
      title: t('Restaurar este backup?'),
      message: t(
        'Tudo volta a ficar como em {date}. O que você criou depois disso é mantido, e o estado atual vira um backup novo (dá para desfazer).',
        { date: when(backup) },
      ),
      confirmLabel: t('Restaurar'),
    });
    if (!ok) return;
    try {
      await useCloudBackupStore.getState().restore(backup.id);
    } catch (restoreError) {
      showError(t('Não foi possível restaurar o backup.'), restoreError);
    }
  };

  const latest = backups?.[0];

  return (
    <>
      <AppText tone="muted">
        Uma cópia completa dos seus dados é salva na nuvem a cada {CLOUD_BACKUP_INTERVAL_DAYS} dias.
        Guardamos as últimas {CLOUD_BACKUPS_KEPT}.
      </AppText>
      <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
        {backups === null
          ? 'Carregando…'
          : latest
            ? t('Último backup: {date}', { date: when(latest) })
            : t('Nenhum backup ainda.')}
      </AppText>
      {error ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <Button
        icon="cloud-upload-outline"
        label={busy ? t('Salvando…') : t('Fazer backup agora')}
        onPress={backupNow}
        disabled={busy}
      />
      {backups && backups.length > 0 ? (
        <View style={styles.list}>
          {backups.map((backup) => (
            <View key={backup.id} style={styles.row}>
              <View style={styles.flex}>
                <AppText>{when(backup)}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('{count} itens', { count: backup.rowCount })}
                </AppText>
              </View>
              <Button
                variant="ghost"
                label={t('Restaurar')}
                onPress={() => void restore(backup)}
                disabled={busy}
              />
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
