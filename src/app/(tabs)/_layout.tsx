import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { WIDE_BREAKPOINT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

const TABS = [
  { name: 'index', title: 'Hoje', icon: 'checkbox-marked-circle-outline' },
  { name: 'habits', title: 'Hábitos', icon: 'format-list-bulleted' },
  { name: 'stats', title: 'Estatísticas', icon: 'chart-box-outline' },
  { name: 'planner', title: 'Planner', icon: 'calendar-month-outline' },
  { name: 'settings', title: 'Ajustes', icon: 'cog-outline' },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Wide screens (web/tablet): sidebar instead of a bottom bar.
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderColor: colors.border },
        // Explicit line height: on web the default label box clips descenders ("j", "g").
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Icon name={tab.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
