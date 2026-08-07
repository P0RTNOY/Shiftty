import { addMonths, format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { isActiveShiftStale, summarizeShifts } from '@/domain/services';
import { ShiftCard } from '@/features/shifts/components/shift-card';
import { ActiveShiftPanel } from '@/features/shifts/components/active-shift-panel';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { useShifts } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { useSalaryDashboard } from '@/features/pay-rules';
import { useShiftPrediction } from '@/features/shifts/hooks/use-shift-prediction';
import { SmartSuggestionCard } from '@/features/shifts/components/smart-suggestion-card';
import { AppScreen, EmptyState, MetricCard, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useLiveNow } from '@/shared/hooks';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { formatDurationLong } from '@/shared/utils/duration-format';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl, formatCurrency, locale } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = format(addMonths(new Date(`${monthStart}T12:00:00`), 1), 'yyyy-MM-dd');
  const start = resolveLocalDateTime(monthStart, '00:00');
  const end = resolveLocalDateTime(nextMonthStart, '00:00');
  const { shifts, loading, error } = useShifts({ endsAfter: start, startsBefore: end, rangeSource: 'salary' });
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const active = useActiveShift();
  const now = useLiveNow();
  const { result: prediction, loading: predictionLoading } = useShiftPrediction();
  const [calculatedAt] = useState(() => new Date().toISOString());
  const [staleDismissed, setStaleDismissed] = useState<string | null>(null);
  const summary = summarizeShifts(shifts);
  const nextShift = shifts.filter((shift) => shift.status === 'scheduled' && shift.scheduledStart && new Date(shift.scheduledStart) >= new Date()).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!))[0];
  const salaryShifts = useMemo(() => active.activeShift ? [active.activeShift] : shifts, [active.activeShift, shifts]);
  const reportingRange = useMemo(() => ({ start, end }), [end, start]);
  const salary = useSalaryDashboard(salaryShifts, active.activeShift ? now.toISOString() : calculatedAt, active.activeShift ? now.toISOString() : undefined, active.activeShift ? undefined : reportingRange);
  const activeSalaryShifts = useMemo(() => active.activeShift ? [active.activeShift] : [], [active.activeShift]);
  const candidateExpectedEnd = active.activeShift?.expectedEnd ?? active.activeShift?.scheduledEnd;
  const activeExpectedEnd = candidateExpectedEnd && active.activeShift?.actualStart && Date.parse(candidateExpectedEnd) > Date.parse(active.activeShift.actualStart) ? candidateExpectedEnd : undefined;
  const activeExpectedSalaryShifts = useMemo(() => activeExpectedEnd ? activeSalaryShifts : [], [activeExpectedEnd, activeSalaryShifts]);
  const expectedSalary = useSalaryDashboard(activeExpectedSalaryShifts, active.activeShift ? now.toISOString() : calculatedAt, activeExpectedEnd);

  if (active.activeShift) {
    const shift = active.activeShift;
    const stale = isActiveShiftStale(shift, now) && staleDismissed !== shift.id;
    const invoke = async (operation: () => Promise<unknown>) => { try { await operation(); } catch { Alert.alert(t('common.error'), t('active.mutationError')); } };
    return <AppScreen eyebrow={t('app.name')} title={t('active.title')}>
      {stale ? <View style={[styles.recovery, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.warning, textAlign: isRtl ? 'right' : 'left' }]}>{t('active.staleTitle')}</Text>
        <Text style={{ color: colors.text, textAlign: isRtl ? 'right' : 'left' }}>{t('active.staleBody')}</Text>
        <PrimaryButton label={t('active.forgotClockOut')} onPress={() => router.push('/shifts/active/end')} />
        <SecondaryButton label={t('active.continue')} onPress={() => setStaleDismissed(shift.id)} />
        <SecondaryButton destructive label={t('active.cancelTracking')} onPress={() => router.push('/shifts/active/cancel')} />
      </View> : null}
      <ActiveShiftPanel breaks={active.breaks} busy={active.busy} now={now} provisionalPay={salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor !== undefined ? formatCurrency(salary.summary.resultsByShiftId[shift.id]!.totalGrossPayMinor!) : undefined} expectedPay={expectedSalary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor !== undefined ? formatCurrency(expectedSalary.summary.resultsByShiftId[shift.id]!.totalGrossPayMinor!) : undefined} salaryIncomplete={salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor === undefined} onChangeExpectedEnd={() => router.push('/shifts/active/expected-end')} onEndBreak={() => void invoke(() => active.endBreak(new Date().toISOString()))} onEndShift={() => router.push('/shifts/active/end')} onManageBreaks={() => router.push(`/shifts/${shift.id}/breaks`)} onOpenDetails={() => router.push(`/shifts/${shift.id}`)} onStartBreak={(paid) => void invoke(() => active.startBreak(paid, new Date().toISOString()))} roleName={roles.find((item) => item.id === shift.roleId)?.name} shift={shift} workplaceName={workplaces.find((item) => item.id === shift.workplaceId)?.name ?? '—'} />
      {active.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('active.mutationError')}</Text> : null}
      {active.salaryError ? <Text accessibilityRole="alert" style={{ color: colors.warning }}>{t('salary.snapshotFailed')}</Text> : null}
    </AppScreen>;
  }

  return (
    <AppScreen eyebrow={t('app.name')} title={t('home.greeting')}>
      {loading ? <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('common.error')}</Text> : null}
      {nextShift ? <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('home.nextShift')}</Text>
        <ShiftCard onPress={() => router.push(`/shifts/${nextShift.id}`)} roleName={roles.find((item) => item.id === nextShift.roleId)?.name} shift={nextShift} templateName={templates.find((item) => item.id === nextShift.shiftTemplateId)?.name} workplaceName={workplaces.find((item) => item.id === nextShift.workplaceId)?.name ?? '—'} />
        {salary.summary?.resultsByShiftId[nextShift.id]?.totalGrossPayMinor !== undefined ? <Text style={{ color: colors.primary, fontWeight: '800', textAlign: isRtl ? 'right' : 'left' }}>{t('salary.expectedForShift')}: {formatCurrency(salary.summary.resultsByShiftId[nextShift.id]!.totalGrossPayMinor!)}</Text> : <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left' }}>{t('salary.missingConfig')}</Text>}
      </View> : !loading ? <EmptyState body={t('home.noNextShiftBody')} title={t('home.noNextShift')} /> : null}
      <PrimaryButton accessibilityHint={t('accessibility.opensScreen')} label={t('home.addFuture')} onPress={() => router.push('/shifts/new?mode=scheduled')} />
      <PrimaryButton accessibilityHint={t('accessibility.opensScreen')} label={t('active.startNow')} onPress={() => router.push('/shifts/start')} />
      <SecondaryButton label={t('home.addCompleted')} onPress={() => router.push('/shifts/new?mode=completed')} />

      {!loading && !predictionLoading && prediction?.recommended && (
        <View style={styles.section}>
          <SmartSuggestionCard
            candidate={prediction.recommended}
            onApplyAll={() => router.push('/shifts/apply-suggestion')}
            onApplySelected={() => router.push('/shifts/apply-suggestion')}
            onReject={() => void 0} // Store rejection later if needed, but orchestrator handles feedback in the hook/screen.
          />
        </View>
      )}

      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}
        >
          {t('home.monthSummary')}
        </Text>
        <View style={[styles.metrics, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <MetricCard label={t('home.completedCount')} value={String(summary.completedCount)} />
          <MetricCard emphasized label={t('home.upcomingCount')} value={String(summary.scheduledCount)} />
        </View>
        {summary.invalidCount > 0 ? (
          <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left', marginTop: spacing.xs }}>
            {summary.invalidCount === 1 ? t('dashboard.invalidShiftsWarning_one') : t('dashboard.invalidShiftsWarning_other', { count: summary.invalidCount })}
          </Text>
        ) : null}
        {salary.summary ? <><View style={[styles.metrics, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><MetricCard label={t('home.earned')} value={formatCurrency(salary.summary.earnedMinor)} /><MetricCard label={t('home.future')} value={formatCurrency(salary.summary.futureMinor)} /><MetricCard emphasized label={t('home.forecast')} value={formatCurrency(salary.summary.forecastMinor)} /><MetricCard label={t('salary.regularHours')} value={formatDurationLong(salary.summary.regularMinutes, locale)} /><MetricCard label={t('salary.specialHours')} value={formatDurationLong(salary.summary.specialRateMinutes, locale)} /></View>{salary.summary.incompleteShiftCount ? <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left' }}>{salary.summary.incompleteShiftCount} {t('salary.incompleteCount')}</Text> : null}{salary.summary.staleShiftCount ? <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left' }}>{salary.summary.staleShiftCount} {t('salary.staleCount')}</Text> : null}</> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.title, fontWeight: '800' },
  metrics: { flexWrap: 'wrap', gap: spacing.sm },
  recovery: { borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
});
