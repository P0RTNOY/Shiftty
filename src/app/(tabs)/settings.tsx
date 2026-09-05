import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SettingsRow } from '@/features/settings/components/settings-row';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing } from '@/shared/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('settings.title')}>
      <View style={styles.section}>
        <SettingsRow icon="business-outline" label={t('settings.workplaces')} onPress={() => router.push('/settings/workplaces')} testID="e2e-settings-workplaces" />
        <SettingsRow icon="cash-outline" label={t('salary.settingsTitle')} onPress={() => router.push('/settings/salary')} testID="e2e-settings-salary" />
        <SettingsRow icon="notifications-outline" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} testID="e2e-settings-notifications" />
        <SettingsRow icon="folder-outline" label={t('settings.dataBackup')} onPress={() => router.push('/settings/data')} testID="e2e-settings-data" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
