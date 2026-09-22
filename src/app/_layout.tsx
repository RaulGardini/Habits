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
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useBootstrap } from '@/db/bootstrap';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const bootstrap = useBootstrap();
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
          <ActivityIndicator color={colors.accent} accessibilityLabel="Carregando" />
        ) : (
          <>
            <AppText variant="heading">Não foi possível abrir seus dados</AppText>
            <AppText tone="muted" style={styles.errorText}>
              {bootstrap.error.message}
            </AppText>
          </>
        )}
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/new" options={{ title: 'Novo hábito', presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Editar hábito' }} />
        <Stack.Screen name="event/new" options={{ title: 'Novo evento', presentation: 'modal' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Editar evento' }} />
        <Stack.Screen name="goal/new" options={{ title: 'Nova meta', presentation: 'modal' }} />
        <Stack.Screen name="goal/[id]" options={{ title: 'Editar meta' }} />
        <Stack.Screen name="stats/[id]" options={{ title: 'Estatísticas do hábito' }} />
        <Stack.Screen name="privacy" options={{ title: 'Política de privacidade' }} />
        <Stack.Screen name="entry" options={{ title: 'Registro do dia', presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
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
