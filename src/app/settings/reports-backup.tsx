import { router } from 'expo-router';
import { View } from 'react-native';

import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { SettingsRow } from '@/features/settings/components/settings-row';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing } from '@/shared/theme';

export default function ReportsBackupScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('settings.reportsBackup')}>
      <SettingsBackButton />
      <View style={{ gap: spacing.sm }}>
        <SettingsRow icon="download-outline" label={t('settings.exports')} onPress={() => router.push('/settings/exports')} />
        <SettingsRow icon="save-outline" label={t('settings.backupRestore')} onPress={() => router.push('/settings/data-management')} />
      </View>
    </AppScreen>
  );
}
