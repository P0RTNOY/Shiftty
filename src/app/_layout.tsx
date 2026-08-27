import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { initializeDatabase } from '@/data/database';
import { AppBootstrap } from '@/features/settings/components/app-bootstrap';
import { DatabaseRecoveryBoundary } from '@/features/settings/components/database-recovery-boundary';
import { configureForegroundNotificationPresentation } from '@/features/shifts/notifications/expo-notification-adapter';
import { DATABASE_NAME } from '@/shared/constants/app';
import { configureNativeRtl, getPreferredLocale, I18nProvider } from '@/shared/i18n';
import { ThemeProvider, useAppTheme } from '@/shared/theme';

const initialLocale = getPreferredLocale();
configureNativeRtl(initialLocale);
configureForegroundNotificationPresentation();

export default function RootLayout() {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <ThemeProvider>
        <DatabaseRecoveryBoundary>
          <DatabaseRoot />
        </DatabaseRecoveryBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}

function DatabaseRoot() {
  const { isDark } = useAppTheme();

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <AppBootstrap>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppBootstrap>
    </SQLiteProvider>
  );
}
