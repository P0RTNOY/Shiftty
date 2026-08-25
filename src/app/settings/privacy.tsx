import { StyleSheet, Text, ScrollView } from 'react-native';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  return (
    <AppScreen title={t('settings.privacy')}>
      <SettingsBackButton />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={headingStyle}>{t('privacy.heading')}</Text>
        <Text style={textStyle}>{t('privacy.localBody')}</Text>
        
        <Text style={headingStyle}>{t('privacy.backupHeading')}</Text>
        <Text style={textStyle}>{t('privacy.backupBody')}</Text>

        <Text style={headingStyle}>{t('privacy.deleteHeading')}</Text>
        <Text style={textStyle}>{t('privacy.deleteBody')}</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  text: {
    fontSize: typography.body,
    lineHeight: 24,
  }
});
