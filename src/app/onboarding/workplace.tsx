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

export default function OnboardingWorkplaceScreen() {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  const db = useSQLiteContext();
  const [workplaceName, setWorkplaceName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [loading, setLoading] = useState(false);

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, textAlign: isRtl ? 'right' as const : 'left' as const }];

  const handleNext = async () => {
    if (!workplaceName.trim()) {
      Alert.alert('שגיאה', 'אנא הזן את שם מקום העבודה');
      return;
    }
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('שגיאה', 'אנא הזן שכר שעתי תקין');
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


      router.push('/onboarding/finish');
    } catch (e: any) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen title="הגדרת מקום עבודה">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={headingStyle}>איפה אתה עובד?</Text>
          <Text style={textStyle}>בוא נגדיר את מקום העבודה הראשון שלך ואת השכר השעתי.</Text>
          
          <View style={styles.formGroup}>
            <Text style={textStyle}>שם מקום העבודה</Text>
            <TextInput 
              style={inputStyle} 
              placeholder="לדוגמה: בית קפה, מסעדה" 
              placeholderTextColor={colors.textMuted}
              value={workplaceName}
              onChangeText={setWorkplaceName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={textStyle}>שכר שעתי (₪)</Text>
            <TextInput 
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
            label={loading ? "שומר..." : "המשך"} 
            onPress={handleNext} 
            disabled={loading}
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
