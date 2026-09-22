import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
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

  useEffect(() => {
    if (bootstrap.status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [bootstrap.status]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (bootstrap.status !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {bootstrap.status === 'loading' ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando" />
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
        <Stack.Screen name="task/[id]" options={{ title: 'Editar tarefa' }} />
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
