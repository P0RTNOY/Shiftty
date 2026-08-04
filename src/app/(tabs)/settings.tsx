import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/features/settings/components/settings-row';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { Alert } from 'react-native';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const repositories = useRepositories();

  const headingStyle = [
    styles.heading,
    { color: colors.textMuted, textAlign: isRtl ? ('right' as const) : ('left' as const) },
  ];

  return (
    <AppScreen title={t('settings.title')}>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.work')}</Text>
        <SettingsRow icon="business-outline" label={t('settings.workplaces')} onPress={() => router.push('/settings/workplaces')} />
        <SettingsRow icon="cash-outline" label={t('settings.salary')} onPress={() => router.push('/settings/salary')} />
        <SettingsRow icon="time-outline" label={t('settings.templates')} onPress={() => router.push('/settings/templates')} />
      </View>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.preferences')}</Text>
        <SettingsRow icon="notifications-outline" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} />
        <SettingsRow icon="language-outline" label={t('settings.language')} />
      </View>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.data')}</Text>
        <SettingsRow icon="download-outline" label={t('settings.exports' as any)} onPress={() => router.push('/settings/exports')} />
        <SettingsRow icon="shield-checkmark-outline" label={t('settings.privacy' as any)} onPress={() => router.push('/settings/privacy')} />
        <SettingsRow icon="save-outline" label={t('settings.dataManagement' as any)} onPress={() => router.push('/settings/data-management')} />
        <SettingsRow 
          icon="trash-outline" 
          label={t('settings.clearPredictions')} 
          onPress={() => {
            Alert.alert(t('settings.clearPredictions'), t('settings.clearPredictionsDesc'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: async () => {
                await repositories.predictionFeedback.clearAll();
                Alert.alert('', t('settings.predictionsCleared'));
              }}
            ]);
          }} 
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { fontSize: typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
});
