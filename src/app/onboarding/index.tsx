import { StyleSheet, Text, View } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { router } from 'expo-router';

export default function OnboardingWelcomeScreen() {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  return (
    <AppScreen title={t('onboarding.welcomeTitle')}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={headingStyle}>{t('onboarding.assistantTitle')}</Text>
          <Text style={textStyle}>{t('onboarding.assistantBody')}</Text>
          
          <Text style={headingStyle}>{t('onboarding.privacyTitle')}</Text>
          <Text style={textStyle}>{t('onboarding.privacyBody')}</Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton 
            label={t('onboarding.start')}
            onPress={() => router.push('/onboarding/workplace')} 
            testID="e2e-onboarding-start"
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  content: { gap: spacing.md, marginTop: spacing.xl },
  heading: { fontSize: typography.heading, fontWeight: '700' },
  text: { fontSize: typography.body, lineHeight: 24 },
  footer: { paddingBottom: spacing.xl },
});
