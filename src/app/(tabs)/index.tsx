import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen, EmptyState, MetricCard, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { formatCurrency, t, isRtl } = useTranslation();

  return (
    <AppScreen eyebrow={t('app.name')} title={t('home.greeting')}>
      <EmptyState body={t('home.noNextShiftBody')} title={t('home.noNextShift')} />
      <PrimaryButton
        accessibilityHint={t('accessibility.opensScreen')}
        label={t('home.addShift')}
        onPress={() => router.navigate('/add-shift')}
      />

      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}
        >
          {t('home.monthSummary')}
        </Text>
        <View style={[styles.metrics, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <MetricCard label={t('home.completedHours')} value="0:00" />
          <MetricCard label={t('home.earned')} value={formatCurrency(0)} />
          <MetricCard label={t('home.future')} value={formatCurrency(0)} />
          <MetricCard emphasized label={t('home.forecast')} value={formatCurrency(0)} />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.title, fontWeight: '800' },
  metrics: { flexWrap: 'wrap', gap: spacing.sm },
});
