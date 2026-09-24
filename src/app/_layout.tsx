import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { useBootstrap } from '@/db/bootstrap';
import { AppLockGate } from '@/features/security/AppLockGate';
import { useSettingsStore } from '@/stores/settingsStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { AppErrorFallback, ScreenErrorFallback } from '@/ui/ErrorFallback';
import { t } from '@/i18n/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

// A crash while rendering a screen replaces only that screen (tabs and navigation keep working);
// anything else falls back to the whole-app error screen.
export const unstable_settings = { screenErrorBoundary: ScreenErrorFallback };
export const ErrorBoundary = AppErrorFallback;

export default function RootLayout() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const bootstrap = useBootstrap();
  const language = useSettingsStore((state) => state.language);
  const { scheme, colors } = useTheme();
  // A font that fails to load falls back to the system font: never block the app on it.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (bootstrap.status !== 'loading' && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [bootstrap.status, fontsReady]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (!fontsReady) return <View style={[styles.center, { backgroundColor: colors.background }]} />;

  if (bootstrap.status !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {bootstrap.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('Carregando')} />
        ) : (
          <>
            <AppText variant="heading">{t('Não foi possível abrir seus dados')}</AppText>
            <AppText tone="muted" style={styles.errorText}>
              {__DEV__
                ? bootstrap.error.message
                : t('Seus dados não foram apagados. Feche o app e abra de novo, ou tente agora.')}
            </AppText>
            <Button label={t('Tentar de novo')} icon="refresh" onPress={bootstrap.retry} />
          </>
        )}
      </View>
    );
  }

  return (
    // Remounting on a language change re-renders every screen with the new strings.
    <AppLockGate>
      <NavigationThemeProvider value={navigationTheme} key={language}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            // iOS: the content scrolls under a translucent header (Liquid Glass on iOS 26).
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect:
              scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterial',
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="habit/new"
            options={{ title: t('Novo hábito'), presentation: 'modal' }}
          />
          <Stack.Screen name="habit/[id]" options={{ title: t('Editar hábito') }} />
          <Stack.Screen
            name="event/new"
            options={{ title: t('Novo evento'), presentation: 'modal' }}
          />
          <Stack.Screen name="event/[id]" options={{ title: t('Editar evento') }} />
          <Stack.Screen
            name="goal/new"
            options={{ title: t('Nova meta'), presentation: 'modal' }}
          />
          <Stack.Screen name="goal/[id]" options={{ title: t('Editar meta') }} />
          <Stack.Screen name="stats/[id]" options={{ title: t('Estatísticas do hábito') }} />
          <Stack.Screen name="privacy" options={{ title: t('Política de privacidade') }} />
          <Stack.Screen name="auth/callback" options={{ title: t('Conta') }} />
          <Stack.Screen name="auth/new-password" options={{ title: t('Nova senha') }} />
          <Stack.Screen
            name="entry"
            options={{ title: t('Registro do dia'), presentation: 'modal' }}
          />
        </Stack>
      </NavigationThemeProvider>
    </AppLockGate>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: { textAlign: 'center' },
});
