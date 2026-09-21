import { StyleSheet } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import type { ThemePreference } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { showError } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';

const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema', icon: 'theme-light-dark' },
  { value: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Escuro', icon: 'weather-night' },
] as const;

export function SettingsScreen() {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Configurações
      </AppText>
      <Card style={styles.card}>
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
      </Card>
      <AppText tone="muted">
        Backup, primeiro dia da semana e outras opções chegam em breve.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
});
