import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useTranslation } from '@/shared/i18n';
import { useAppTheme } from '@/shared/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  calendar: { active: 'calendar', inactive: 'calendar-outline' },
  'add-shift': { active: 'add-circle', inactive: 'add-circle-outline' },
  reports: { active: 'document-text', inactive: 'document-text-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused, size }) => {
          const icon = ICONS[route.name] ?? ICONS.index!;
          return <Ionicons color={color} name={focused ? icon.active : icon.inactive} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="calendar" options={{ title: t('nav.calendar') }} />
      <Tabs.Screen name="add-shift" options={{ title: t('nav.addShift') }} />
      <Tabs.Screen name="reports" options={{ title: t('nav.reports') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
