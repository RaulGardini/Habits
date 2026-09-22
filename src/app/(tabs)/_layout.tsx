import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, WIDE_BREAKPOINT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

const TABS = [
  { name: 'index', title: 'Hoje', icon: 'white-balance-sunny', sf: ['sun.max', 'sun.max.fill'] },
  {
    name: 'habits',
    title: 'Hábitos',
    icon: 'format-list-checks',
    sf: ['list.bullet.circle', 'list.bullet.circle.fill'],
  },
  {
    name: 'stats',
    title: 'Estatísticas',
    icon: 'chart-box-outline',
    sf: ['chart.bar', 'chart.bar.fill'],
  },
  {
    name: 'agenda',
    title: 'Agenda',
    icon: 'calendar-month-outline',
    sf: ['calendar', 'calendar.circle.fill'],
  },
  { name: 'settings', title: 'Ajustes', icon: 'cog-outline', sf: ['gearshape', 'gearshape.fill'] },
] as const;

export default function TabsLayout() {
  return Platform.OS === 'ios' ? <IosTabs /> : <JsTabs />;
}

/** iOS: the system tab bar (Liquid Glass on iOS 26, translucent bar before that). */
function IosTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: tab.sf[0], selected: tab.sf[1] }} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

/** Android and web: JS tabs; a frosted bottom bar, or a sidebar on wide screens. */
function JsTabs() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const frosted =
    Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px) saturate(180%)', backgroundColor: colors.glass } as object)
      : { backgroundColor: colors.surface };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Wide screens (web/tablet): sidebar instead of a bottom bar.
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: wide ? colors.primarySoft : undefined,
        tabBarItemStyle: wide
          ? { borderRadius: 999, marginHorizontal: 8, marginVertical: 2 }
          : undefined,
        tabBarStyle: [{ borderColor: colors.border, borderTopWidth: wide ? 0 : 0.5 }, frosted],
        // Explicit line height: on web the default label box clips descenders ("j", "g").
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 16,
          paddingBottom: 2,
          fontFamily: fonts.semibold,
        },
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
