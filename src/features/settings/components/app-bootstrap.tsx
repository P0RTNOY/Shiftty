import { useEffect, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteShiftRepository, SqliteRecurrenceRepository, SqliteShiftTemplateRepository } from '@/data/repositories';
import { useAppStore } from '@/features/settings/store/app-store';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { NotificationLifecycle } from '@/features/shifts/components/notification-lifecycle';
import { NotificationResponseLifecycle } from '@/features/shifts/components/notification-response-lifecycle';

export function AppBootstrap({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const bootstrapStatus = useAppStore((state) => state.bootstrapStatus);
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    if (bootstrapStatus === 'idle') {
      void bootstrap({
        shifts: new SqliteShiftRepository(database),
        recurrence: new SqliteRecurrenceRepository(database),
        templates: new SqliteShiftTemplateRepository(database),
      });
    }
  }, [bootstrap, bootstrapStatus, database]);

  if (bootstrapStatus === 'ready') {
    return <><NotificationLifecycle /><NotificationResponseLifecycle />{children}</>;
  }

  if (bootstrapStatus === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="alert" style={[styles.message, { color: colors.danger }]}>
          {t('bootstrap.error')}
        </Text>
        <PrimaryButton
          label={t('bootstrap.retry')}
          onPress={() => void bootstrap({
            shifts: new SqliteShiftRepository(database),
            recurrence: new SqliteRecurrenceRepository(database),
            templates: new SqliteShiftTemplateRepository(database),
          })}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator accessibilityLabel={t('bootstrap.loading')} color={colors.primary} size="large" />
      <Text style={[styles.message, { color: colors.text }]}>{t('bootstrap.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
});
