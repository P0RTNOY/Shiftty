import { StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/features/settings/components/settings-row';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const headingStyle = [
    styles.heading,
    { color: colors.textMuted, textAlign: isRtl ? ('right' as const) : ('left' as const) },
  ];

  return (
    <AppScreen title={t('settings.title')}>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.work')}</Text>
        <SettingsRow icon="business-outline" label={t('settings.workplaces')} />
        <SettingsRow icon="cash-outline" label={t('settings.salary')} />
        <SettingsRow icon="time-outline" label={t('settings.templates')} />
      </View>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.preferences')}</Text>
        <SettingsRow icon="notifications-outline" label={t('settings.notifications')} />
        <SettingsRow icon="language-outline" label={t('settings.language')} />
      </View>
      <View style={styles.section}>
        <Text style={headingStyle}>{t('settings.data')}</Text>
        <SettingsRow icon="shield-checkmark-outline" label={t('settings.backup')} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { fontSize: typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
});
