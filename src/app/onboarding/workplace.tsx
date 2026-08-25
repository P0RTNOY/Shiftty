import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Alert } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { WorkplaceSetupService } from '@/domain/services';
import { SqliteWorkplaceRepository } from '@/data/repositories/sqlite-workplace-repository';
import { SqliteSalaryProfileRepository } from '@/data/repositories/sqlite-salary-repositories';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export default function OnboardingWorkplaceScreen() {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const db = useSQLiteContext();
  const [workplaceName, setWorkplaceName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [loading, setLoading] = useState(false);

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, textAlign: isRtl ? 'right' as const : 'left' as const }];

  const handleNext = async () => {
    if (!workplaceName.trim()) {
      Alert.alert(t('common.error'), t('onboarding.nameRequired'));
      return;
    }
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      Alert.alert(t('common.error'), t('onboarding.rateInvalid'));
      return;
    }

    try {
      setLoading(true);
      
      const workplaceRepo = new SqliteWorkplaceRepository(db);
      const salaryProfileRepo = new SqliteSalaryProfileRepository(db);
      const setupService = new WorkplaceSetupService(db, workplaceRepo, salaryProfileRepo);
      
      await setupService.createInitialWorkplace({
        name: workplaceName.trim(),
        standardHourlyRateMinor: Math.round(rate * 100),
      });


      router.replace('/(tabs)');
    } catch (error) {
      reportUnexpectedError('onboarding.workplace.save', error);
      Alert.alert(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen title={t('onboarding.workplaceTitle')}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={headingStyle}>{t('onboarding.workplaceHeading')}</Text>
          <Text style={textStyle}>{t('onboarding.workplaceBody')}</Text>
          
          <View style={styles.formGroup}>
            <Text style={textStyle}>{t('onboarding.workplaceName')}</Text>
            <TextInput 
              accessibilityLabel={t('onboarding.workplaceName')}
              testID="e2e-onboarding-workplace-name"
              style={inputStyle} 
              placeholder={t('onboarding.workplacePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={workplaceName}
              onChangeText={setWorkplaceName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={textStyle}>{t('onboarding.hourlyRate')}</Text>
            <TextInput 
              accessibilityLabel={t('onboarding.hourlyRate')}
              testID="e2e-onboarding-hourly-rate"
              style={inputStyle} 
              placeholder="0.00" 
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={hourlyRate}
              onChangeText={setHourlyRate}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton 
            label={loading ? t('onboarding.saving') : t('onboarding.continue')}
            onPress={handleNext} 
            disabled={loading}
            testID="e2e-onboarding-complete"
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
  text: { fontSize: typography.body },
  formGroup: { gap: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.body,
  },
  footer: { paddingBottom: spacing.xl },
});
