import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReportShiftRow } from '@/features/reports/report-shift-row';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { useMonthlyReport } from '@/features/reports/use-monthly-report';
import { AppScreen, EmptyState, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatMonth } from '@/shared/utils/date-time-format';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

const REPORT_TIMEZONE = 'Asia/Jerusalem';

export default function ReportsScreen() {
  const { t, locale, formatCurrency, isRtl } = useTranslation();
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => formatLocalDateKey(new Date(), REPORT_TIMEZONE).slice(0, 7));
  const { report, loading, error } = useMonthlyReport(month, REPORT_TIMEZONE);
  const align = isRtl ? 'right' : 'left';

  return <AppScreen title={t('reports.title')}>
    <View style={[styles.navigation, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <MonthButton label={t('reports.previousMonth')} onPress={() => setMonth((value) => addMonths(value, -1))} />
      <Text accessibilityRole="header" style={[styles.monthTitle, { color: colors.text }]}>{formatMonth(month, locale)}</Text>
      <MonthButton label={t('reports.nextMonth')} onPress={() => setMonth((value) => addMonths(value, 1))} />
    </View>

    {loading ? <Text style={{ color: colors.textMuted, textAlign: align }}>{t('common.loading')}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: align }}>{t('common.error')}</Text> : null}

    {!loading && report && report.rows.length === 0 ? <EmptyState body={t('reports.emptyBody')} title={t('reports.empty')} /> : null}

    {report && report.rows.length > 0 ? <>
      <View style={styles.headline}>
        <Text style={[styles.headlineValue, { color: colors.text, textAlign: align }]}>{report.totals.shiftCount === 1 ? t('reports.completedShiftCountOne') : t('reports.completedShiftCount', { count: report.totals.shiftCount })}</Text>
        <Text style={[styles.headlineValue, { color: colors.text, textAlign: align }]}>{t('reports.workedDuration', { duration: formatDurationLong(report.totals.paidMinutes, locale) })}</Text>
        {report.totals.salaryMinor === undefined
          ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign: align }]}>{report.totals.salaryIssueCount === 1 ? t('reports.salaryUnavailableOne') : t('reports.salaryUnavailable', { count: report.totals.salaryIssueCount })}</Text>
          : <Text style={[styles.salary, { color: colors.primary, textAlign: align }]}>{t('reports.earnedAmount', { amount: formatCurrency(report.totals.salaryMinor) })}</Text>}
        {report.totals.invalidShiftCount > 0 ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign: align }]}>{t('reports.invalidShiftCount', { count: report.totals.invalidShiftCount })}</Text> : null}
      </View>

      <SalaryTrustDisclosure mode="generic" onOpenSalarySettings={() => router.push('/settings/salary')} />

      {report.totals.salaryIssueCount > 0 ? <SecondaryButton label={t('salary.openSettings')} onPress={() => router.push('/settings/salary')} /> : null}

      <View style={styles.shiftList}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, textAlign: align }]}>{t('reports.shifts')}</Text>
        {report.rows.map((row) => <ReportShiftRow
          key={row.shiftId}
          onPress={() => router.push(`/shifts/${row.shiftId}`)}
          paidMinutes={row.paidMinutes}
          salaryMinor={row.salaryMinor}
          salaryStatus={row.salaryStatus}
          specialIntervals={row.specialIntervals}
          shift={row.shift}
          workplaceName={row.workplaceName}
        />)}
      </View>

      <PrimaryButton label={t('reports.export')} onPress={() => router.push(`/settings/exports?month=${month}`)} />
    </> : null}
  </AppScreen>;
}

function MonthButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{label}</Text></Pressable>;
}

function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  navigation: { alignItems: 'center', gap: spacing.xs, justifyContent: 'space-between' },
  monthTitle: { fontSize: typography.title, fontWeight: '800' },
  headline: { gap: spacing.xs },
  headlineValue: { fontSize: typography.heading, fontWeight: '800' },
  salary: { fontSize: typography.heading, fontWeight: '800' },
  warning: { fontSize: typography.body, fontWeight: '700' },
  shiftList: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.title, fontWeight: '800' },
  choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
});
