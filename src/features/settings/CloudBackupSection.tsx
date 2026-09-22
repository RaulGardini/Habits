import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  format(new Date(backup.createdAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR });

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
      title: 'Restaurar este backup?',
      message: `Tudo volta a ficar como em ${when(backup)}. O que você criou depois disso é mantido, e o estado atual vira um backup novo (dá para desfazer).`,
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    try {
      await useCloudBackupStore.getState().restore(backup.id);
    } catch (restoreError) {
      showError('Não foi possível restaurar o backup.', restoreError);
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
            ? `Último backup: ${when(latest)}`
            : 'Nenhum backup ainda.'}
      </AppText>
      {error ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <Button
        icon="cloud-upload-outline"
        label={busy ? 'Salvando…' : 'Fazer backup agora'}
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
                  {backup.rowCount} {backup.rowCount === 1 ? 'item' : 'itens'}
                </AppText>
              </View>
              <Button
                variant="ghost"
                label="Restaurar"
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
