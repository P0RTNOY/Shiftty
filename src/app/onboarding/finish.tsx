import { useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

export default function OnboardingFinishScreen() {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  const completeOnboarding = async () => {
    try {
      setLoading(true);
      await db.runAsync(
        "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('onboarding_completed', 'true', datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = 'true', updated_at = datetime('now')"
      );
      router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <AppScreen title={t('onboarding.finishTitle')}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={headingStyle}>{t('onboarding.finishHeading')}</Text>
          <Text style={textStyle}>{t('onboarding.finishBody')}</Text>
        </View>

        <View style={styles.footer}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <PrimaryButton 
              label={t('onboarding.enterApp')}
              onPress={completeOnboarding} 
            />
          )}
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
