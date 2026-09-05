import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { SettingsRow } from '@/features/settings/components/settings-row';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { AppScreen, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing } from '@/shared/theme';

export default function DataBackupScreen() {
  const repositories = useRepositories();
  const { t } = useTranslation();
  const clearPredictions = () => Alert.alert(t('settings.clearPredictions'), t('settings.clearPredictionsDesc'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: async () => { await repositories.predictionFeedback.clearAll(); Alert.alert('', t('settings.predictionsCleared')); } },
  ]);
  return <AppScreen title={t('settings.dataBackup')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <View style={styles.section}>
      <SettingsRow icon="download-outline" label={t('settings.exports')} onPress={() => router.push('/settings/exports')} testID="e2e-data-exports" />
      <SettingsRow icon="save-outline" label={t('settings.backupRestore')} onPress={() => router.push('/settings/data-management')} testID="e2e-data-backup" />
      <SettingsRow icon="shield-checkmark-outline" label={t('settings.privacy')} onPress={() => router.push('/settings/privacy')} />
      <SettingsRow icon="trash-outline" label={t('settings.clearPredictions')} onPress={clearPredictions} />
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({ section: { gap: spacing.sm } });
