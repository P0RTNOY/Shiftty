import { addHours, addMonths, format, subHours } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { buildEndShiftReview, createActiveShift, isActiveShiftStale, resolveClockInDecision, summarizeShifts } from '@/domain/services';
import { ShiftCard } from '@/features/shifts/components/shift-card';
import { ActiveShiftPanel } from '@/features/shifts/components/active-shift-panel';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { useShifts } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { useSalaryDashboard } from '@/features/pay-rules';
import { ClockInWorkplacePicker } from '@/features/shifts/components/clock-in-workplace-picker';
import { QuickClockOutReview } from '@/features/shifts/components/quick-clock-out-review';
import { AppScreen, EmptyState, MetricCard, PrimaryButton, SecondaryButton } from '@/shared/components';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useLiveNow } from '@/shared/hooks';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { createId } from '@/shared/utils/id';
import { systemClock } from '@/shared/utils/clock';
import { resolveActiveCalculationEnd } from '@/features/pay-rules/services/active-calculation-time';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl, formatCurrency, locale } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = format(addMonths(new Date(`${monthStart}T12:00:00`), 1), 'yyyy-MM-dd');
  const start = resolveLocalDateTime(monthStart, '00:00');
  const end = resolveLocalDateTime(nextMonthStart, '00:00');
  const { shifts, loading, error, refresh: refreshShifts } = useShifts({ endsAfter: start, startsBefore: end, rangeSource: 'salary' });
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const active = useActiveShift();
  const now = useLiveNow();
  const { shifts: nearbyScheduledShifts, loading: nearbyLoading, error: nearbyError } = useShifts({
    endsAfter: subHours(now, 3).toISOString(),
    startsBefore: addHours(now, 3).toISOString(),
    statuses: ['scheduled'],
    rangeSource: 'display',
  });
  const [calculatedAt] = useState(() => new Date().toISOString());
  const [staleDismissed, setStaleDismissed] = useState<string | null>(null);
  const [clockInWorkplaceIds, setClockInWorkplaceIds] = useState<string[] | null>(null);
  const [clockOutAt, setClockOutAt] = useState<string | null>(null);
  const liveNow = now.toISOString();
  const activeCalculationEnd = active.activeShift?.actualStart
    ? resolveActiveCalculationEnd(active.activeShift.actualStart, liveNow)
    : liveNow;
  const summary = summarizeShifts(shifts);
  const nextShift = shifts.filter((shift) => shift.status === 'scheduled' && shift.scheduledStart && new Date(shift.scheduledStart) >= new Date()).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!))[0];
  const salaryShifts = useMemo(() => active.activeShift ? [active.activeShift] : shifts, [active.activeShift, shifts]);
  const reportingRange = useMemo(() => ({ start, end }), [end, start]);
  const salary = useSalaryDashboard(salaryShifts, active.activeShift ? activeCalculationEnd : calculatedAt, active.activeShift ? activeCalculationEnd : undefined, active.activeShift ? undefined : reportingRange);
  const activeSalaryShifts = useMemo(() => active.activeShift ? [active.activeShift] : [], [active.activeShift]);
  const candidateExpectedEnd = active.activeShift?.expectedEnd ?? active.activeShift?.scheduledEnd;
  const activeExpectedEnd = candidateExpectedEnd && active.activeShift?.actualStart && Date.parse(candidateExpectedEnd) > Date.parse(active.activeShift.actualStart) ? candidateExpectedEnd : undefined;
  const activeExpectedSalaryShifts = useMemo(() => activeExpectedEnd ? activeSalaryShifts : [], [activeExpectedEnd, activeSalaryShifts]);
  const expectedSalary = useSalaryDashboard(activeExpectedSalaryShifts, active.activeShift ? now.toISOString() : calculatedAt, activeExpectedEnd);

  const startAtWorkplace = async (workplaceId: string) => {
    const workplace = workplaces.find((item) => item.id === workplaceId);
    if (!workplace) return;
    const timestamp = systemClock.now().toISOString();
    try {
      await active.startUnscheduled(createActiveShift(
        { workplace },
        { id: createId('shift'), now: timestamp, timezone: DEFAULT_TIMEZONE },
      ));
      setClockInWorkplaceIds(null);
    } catch {
      Alert.alert(t('common.error'), t('active.mutationError'));
    }
  };

  const clockIn = async () => {
    if (nearbyError) {
      Alert.alert(t('common.error'), t('active.mutationError'));
      return;
    }
    const decision = resolveClockInDecision({ shifts: nearbyScheduledShifts, workplaces, now });
    if (decision.kind === 'scheduled') {
      try { await active.startScheduled(decision.shiftId, systemClock.now().toISOString()); }
      catch { Alert.alert(t('common.error'), t('active.mutationError')); }
      return;
    }
    if (decision.kind === 'workplace') {
      await startAtWorkplace(decision.workplaceId);
      return;
    }
    if (decision.kind === 'choose-workplace') {
      setClockInWorkplaceIds(decision.workplaceIds);
      return;
    }
    if (decision.kind === 'choose-shift') {
      router.push('/shifts/start');
      return;
    }
    Alert.alert(t('common.error'), t('active.noWorkplace'));
  };

  if (active.activeShift) {
    const shift = active.activeShift;
    const stale = isActiveShiftStale(shift, now) && staleDismissed !== shift.id;
    const invoke = async (operation: () => Promise<unknown>) => { try { await operation(); } catch { Alert.alert(t('common.error'), t('active.mutationError')); } };
    const saveQuickClockOut = async () => {
      if (!clockOutAt || !shift.actualStart) return;
      try {
        const review = buildEndShiftReview(shift, active.breaks, clockOutAt);
        await active.completeShift({
          shiftId: shift.id,
          actualEnd: clockOutAt,
          payableStart: shift.actualStart,
          payableEnd: clockOutAt,
          actualBreakMinutes: review.unpaidBreakMinutes,
          payableBreakMinutes: review.unpaidBreakMinutes,
          payableSource: 'actual',
          closeOpenBreak: active.breaks.some((item) => !item.end),
        });
        await refreshShifts();
        setClockOutAt(null);
      } catch {
        Alert.alert(t('common.error'), t('active.mutationError'));
      }
    };
    return <AppScreen eyebrow={t('app.name')} title={t('active.title')}>
      {stale ? <View style={[styles.recovery, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.warning, textAlign: isRtl ? 'right' : 'left' }]}>{t('active.staleTitle')}</Text>
        <Text style={{ color: colors.text, textAlign: isRtl ? 'right' : 'left' }}>{t('active.staleBody')}</Text>
        <PrimaryButton label={t('active.forgotClockOut')} onPress={() => router.push('/shifts/active/end')} />
        <SecondaryButton label={t('active.continue')} onPress={() => setStaleDismissed(shift.id)} />
        <SecondaryButton destructive label={t('active.cancelTracking')} onPress={() => router.push('/shifts/active/cancel')} />
      </View> : null}
      {clockOutAt ? <QuickClockOutReview
        actualEnd={clockOutAt}
        breaks={active.breaks}
        busy={active.busy}
        estimatedPay={salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor !== undefined ? formatCurrency(salary.summary.resultsByShiftId[shift.id]!.totalGrossPayMinor!) : undefined}
        onCancel={() => setClockOutAt(null)}
        onEdit={() => { setClockOutAt(null); router.push('/shifts/active/end'); }}
        onSave={() => void saveQuickClockOut()}
        shift={shift}
      /> : <ActiveShiftPanel breaks={active.breaks} busy={active.busy} now={now} provisionalPay={salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor !== undefined ? formatCurrency(salary.summary.resultsByShiftId[shift.id]!.totalGrossPayMinor!) : undefined} expectedPay={expectedSalary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor !== undefined ? formatCurrency(expectedSalary.summary.resultsByShiftId[shift.id]!.totalGrossPayMinor!) : undefined} salaryIncomplete={salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor === undefined} onChangeExpectedEnd={() => router.push('/shifts/active/expected-end')} onEndBreak={() => void invoke(() => active.endBreak(systemClock.now().toISOString()))} onEndShift={() => setClockOutAt(systemClock.now().toISOString())} onManageBreaks={() => router.push(`/shifts/${shift.id}/breaks`)} onOpenDetails={() => router.push(`/shifts/${shift.id}`)} onStartBreak={(paid) => void invoke(() => active.startBreak(paid, systemClock.now().toISOString()))} roleName={roles.find((item) => item.id === shift.roleId)?.name} shift={shift} workplaceName={workplaces.find((item) => item.id === shift.workplaceId)?.name ?? '—'} />}
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
      <PrimaryButton disabled={active.busy || nearbyLoading} label={t('active.clockIn')} onPress={() => void clockIn()} />
      {clockInWorkplaceIds ? <ClockInWorkplacePicker
        busy={active.busy}
        onCancel={() => setClockInWorkplaceIds(null)}
        onChoose={(workplaceId) => void startAtWorkplace(workplaceId)}
        workplaces={workplaces.filter((item) => clockInWorkplaceIds.includes(item.id))}
      /> : null}
      <SecondaryButton label={t('home.addFuture')} onPress={() => router.push('/shifts/new?mode=scheduled')} />
      <SecondaryButton label={t('home.addCompleted')} onPress={() => router.push('/shifts/new?mode=completed')} />

      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}
        >
          {t('home.monthSummary')}
        </Text>
        <View style={[styles.metrics, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <MetricCard label={t('home.completedHours')} value={formatDurationLong(summary.workedMinutes, locale)} />
          {salary.summary ? <MetricCard emphasized label={t('home.earned')} value={formatCurrency(salary.summary.earnedMinor)} /> : null}
        </View>
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
