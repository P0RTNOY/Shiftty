import { StyleSheet, Text, View } from 'react-native';
import type { BreakSession, Shift } from '@/domain/entities';
import { calculateLiveShiftMetrics, resolveExpectedEnd } from '@/domain/services';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationCompact, formatTimer } from '@/shared/utils/duration-format';
import { differenceInMinutes } from 'date-fns';
import { useLiveNow } from '@/shared/hooks/use-live-now';
import { systemClock } from '@/shared/utils/clock';

interface Props { shift: Shift; breaks: readonly BreakSession[]; workplaceName: string; roleName?: string; now: Date; busy?: boolean; provisionalPay?: string; expectedPay?: string; salaryIncomplete?: boolean; onStartBreak: (paid: boolean) => void; onEndBreak?: () => void; onEndShift: () => void; onOpenDetails: () => void; onManageBreaks: () => void; onChangeExpectedEnd?: () => void }

function ActiveShiftTimer({ shift, breaks }: { shift: Shift; breaks: readonly BreakSession[] }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const now = useLiveNow(systemClock, 1000);
  
  const actualStartMs = Date.parse(shift.actualStart!);
  const elapsedMs = Math.max(0, now.getTime() - actualStartMs);
  
  return (
    <Text accessibilityLabel={`${t('active.elapsed')} ${formatTimer(elapsedMs)}`} style={[styles.timer, { color: colors.text }]}>
      {formatTimer(elapsedMs)}
    </Text>
  );
}

function ActiveBreakTimer({ session }: { session: BreakSession }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const now = useLiveNow(systemClock, 1000);
  
  const startMs = Date.parse(session.start);
  const elapsedMs = Math.max(0, now.getTime() - startMs);
  
  return <Metric label={t('active.breakDuration')} value={formatTimer(elapsedMs)} />;
}

export function ActiveShiftPanel({ shift, breaks, workplaceName, roleName, now, busy = false, provisionalPay, expectedPay, salaryIncomplete, ...actions }: Props) {
  const { colors } = useAppTheme(); const { formatDate, isRtl, t } = useTranslation();
  const metrics = calculateLiveShiftMetrics(shift, breaks, now); const expectedEnd = resolveExpectedEnd(shift);
  const scheduledDifference = shift.scheduledStart ? differenceInMinutes(shift.actualStart!, shift.scheduledStart) : 0;
  const activeBreak = breaks.find(b => !b.end);
  const align = isRtl ? 'right' : 'left';
  return <View style={styles.container}>
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: metrics.isOnBreak ? colors.warning : colors.primary }]}>
      <Text accessibilityRole="header" style={[styles.state, { color: metrics.isOnBreak ? colors.warning : colors.success, textAlign: align }]}>{metrics.isOnBreak ? t('active.onBreak') : t('active.working')}</Text>
      <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{shift.title || workplaceName}</Text>
      {roleName ? <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{roleName}</Text> : null}
      
      <ActiveShiftTimer shift={shift} breaks={breaks} />
      
      <View style={styles.metrics}>
        <Metric label={t('active.netWorked')} value={formatDurationCompact(metrics.netWorkedMinutes)} />
        <Metric label={t('active.unpaidBreaks')} value={formatDurationCompact(metrics.unpaidBreakMinutes)} />
        <Metric label={t('active.paidBreaks')} value={formatDurationCompact(metrics.paidBreakMinutes)} />
        {activeBreak ? <ActiveBreakTimer session={activeBreak} /> : null}
      </View>
      <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t('active.actualStart')}: {formatDate(shift.actualStart!, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}</Text>
      {provisionalPay ? <Text accessibilityLabel={`${t('salary.provisionalNow')} ${provisionalPay}`} style={[styles.provisional, { color: colors.primary, textAlign: align }]}>{t('salary.provisionalNow')}: {provisionalPay} · {t('salary.estimateOnly')}</Text> : null}
      {expectedPay ? <Text style={[styles.meta, { color: colors.primary, textAlign: align }]}>{t('salary.provisionalEnd')}: {expectedPay}</Text> : null}
      {salaryIncomplete ? <Text accessibilityRole="alert" style={[styles.meta, { color: colors.warning, textAlign: align }]}>{t('salary.missingConfig')}</Text> : null}
      {shift.scheduledStart && shift.scheduledEnd ? <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t('active.scheduled')}: {formatDate(shift.scheduledStart, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}–{formatDate(shift.scheduledEnd, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}</Text> : null}
      {shift.scheduledStart && scheduledDifference !== 0 ? <Text style={[styles.meta, { color: colors.warning, textAlign: align }]}>{scheduledDifference < 0 ? t('active.startedEarly') : t('active.startedLate')} {Math.abs(scheduledDifference)} {t('active.minutes')}</Text> : null}
      {expectedEnd ? <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t('active.expectedEnd')}: {formatDate(expectedEnd, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}</Text> : null}
    </View>
    {metrics.isOnBreak ? <PrimaryButton disabled={busy} label={t('active.endBreak')} onPress={() => actions.onEndBreak?.()} /> : <>
      <PrimaryButton disabled={busy} label={t('active.startUnpaidBreak')} onPress={() => actions.onStartBreak(false)} />
      <SecondaryButton disabled={busy} label={t('active.startPaidBreak')} onPress={() => actions.onStartBreak(true)} />
    </>}
    <SecondaryButton disabled={busy} label={t('active.manageBreaks')} onPress={actions.onManageBreaks} />
    <SecondaryButton disabled={busy} label={t('active.changeExpectedEnd')} onPress={() => actions.onChangeExpectedEnd?.()} />
    <PrimaryButton disabled={busy} label={t('active.endShift')} onPress={actions.onEndShift} />
    <SecondaryButton label={t('active.details')} onPress={actions.onOpenDetails} />
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) { const { colors } = useAppTheme(); const { isRtl } = useTranslation(); return <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ container: { gap: spacing.sm }, hero: { borderRadius: radius.lg, borderWidth: 2, gap: spacing.sm, padding: spacing.lg }, state: { fontSize: typography.title, fontWeight: '800' }, title: { fontSize: typography.heading, fontWeight: '800' }, meta: { fontSize: typography.body }, provisional: { fontSize: typography.title, fontWeight: '800' }, timer: { fontSize: 46, fontVariant: ['tabular-nums'], fontWeight: '800', textAlign: 'center' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metric: { flexBasis: '46%', flexGrow: 1, gap: spacing.xxs }, metricLabel: { fontSize: typography.caption }, metricValue: { fontSize: typography.title, fontVariant: ['tabular-nums'], fontWeight: '700' } });
