import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { t } from '@/i18n/i18n';
import { useAppLockStore } from '@/stores/appLockStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/**
 * Covers the app while it is locked — and, with the lock on, whenever it is not in the
 * foreground, so the app switcher snapshot shows no data. The screens stay mounted underneath:
 * unlocking returns exactly where the user was.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const enabled = useAppLockStore((state) => state.enabled);
  const locked = useAppLockStore((state) => state.locked);
  const unlock = useAppLockStore((state) => state.unlock);
  // Only a known "away" state hides the app: the state can be "unknown" until the first event.
  const [away, setAway] = useState(isAway(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setAway(isAway(status)));
    return () => subscription.remove();
  }, []);

  // Ask right away when the app gets locked (cold start, or back after a while). Only on that
  // transition: a cancelled prompt leaves the button, instead of asking again in a loop.
  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  const covered = locked || (enabled && away);
  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {covered ? (
        <View
          style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.background }]}
        >
          <Icon name="lock-outline" size={40} color={colors.accent} />
          <AppText variant="heading" accessibilityRole="header">
            Habits
          </AppText>
          {locked ? (
            <>
              <AppText tone="muted">{t('O app está bloqueado.')}</AppText>
              <Button
                label={t('Desbloquear')}
                icon="lock-open-variant-outline"
                onPress={() => void unlock()}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function isAway(status: string | null | undefined): boolean {
  return status === 'inactive' || status === 'background';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
