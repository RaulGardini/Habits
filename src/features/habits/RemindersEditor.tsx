import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isValidTime } from '@/core/habits/validation';
import { ensurePermission, notificationsSupported } from '@/lib/notifications';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { TimeField } from '@/ui/TimeField';
import { t } from '@/i18n/i18n';

interface RemindersEditorProps {
  value: string[];
  onChange: (times: string[]) => void;
  error?: string;
}

export function RemindersEditor({ value, onChange, error }: RemindersEditorProps) {
  const { colors } = useTheme();
  const [time, setTime] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const add = async () => {
    const normalized = /^\d:\d{2}$/.test(time) ? `0${time}` : time;
    if (!isValidTime(normalized)) {
      setMessage(t('Informe um horário válido, como 08:30.'));
      return;
    }
    if (value.includes(normalized)) {
      setMessage(t('Esse horário já foi adicionado.'));
      return;
    }
    onChange([...value, normalized].sort());
    setTime('');
    setMessage(null);
    if (notificationsSupported && !(await ensurePermission())) {
      setMessage(
        t(
          'As notificações estão desativadas. Ative-as nas configurações do sistema para receber os lembretes.',
        ),
      );
    }
  };

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {t('Lembretes')}
      </AppText>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((reminder) => (
            <View
              key={reminder}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
              ]}
            >
              <Icon name="bell-outline" size={16} color={colors.textMuted} />
              <AppText variant="bodyStrong">{reminder}</AppText>
              <IconButton
                icon="close"
                size={18}
                label={t('Remover lembrete das {time}', { time: reminder })}
                onPress={() => onChange(value.filter((t) => t !== reminder))}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TimeField label={t('Novo horário')} value={time} onChange={setTime} />
        </View>
        <Button variant="secondary" icon="bell-plus-outline" label={t('Adicionar')} onPress={add} />
      </View>
      {!notificationsSupported ? (
        <AppText variant="caption" tone="muted">
          {t('Os lembretes são enviados pelo app no Android e no iOS (não no navegador).')}
        </AppText>
      ) : null}
      {message || error ? (
        <AppText variant="caption" tone={colors.danger} accessibilityLiveRegion="polite">
          {message ?? error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
});
