import { addMonths, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { summarizeShifts } from '@/domain/services';
import { useShifts } from '@/features/shifts/hooks/use-shifts';
import { AppScreen, EmptyState, MetricCard } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { useSalaryDashboard } from '@/features/pay-rules';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';

export default function ReportsScreen() {
  const { t, locale, formatCurrency, isRtl } = useTranslation();
  const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => new Date()); const [workplaceId, setWorkplaceId] = useState('all'); const [roleId, setRoleId] = useState('all'); const [status, setStatus] = useState('all');
  const { workplaces, roles } = useWorkplaces();
  const monthStart = `${format(month, 'yyyy-MM').slice(0, 7)}-01`;
  const nextMonth = format(addMonths(new Date(`${monthStart}T12:00:00`), 1), 'yyyy-MM-dd');
  const reportingRange = useMemo(() => ({ start: resolveLocalDateTime(monthStart, '00:00'), end: resolveLocalDateTime(nextMonth, '00:00') }), [monthStart, nextMonth]);
  const { shifts, loading } = useShifts({ endsAfter: reportingRange.start, startsBefore: reportingRange.end, rangeSource: 'salary' });
  const filtered = useMemo(() => shifts.filter((shift) => (workplaceId === 'all' || shift.workplaceId === workplaceId) && (roleId === 'all' || shift.roleId === roleId) && (status === 'all' || shift.status === status)), [roleId, shifts, status, workplaceId]);
  const summary = summarizeShifts(filtered);
  const salary = useSalaryDashboard(filtered, new Date(`${monthStart}T12:00:00+03:00`).toISOString(), undefined, reportingRange);

  return (
    <AppScreen title={t('reports.title')}>
      <View style={[styles.navigation, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><FilterButton label={t('reports.previousMonth')} onPress={() => setMonth((value) => addMonths(value, -1))} /><Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800' }}>{format(month, 'yyyy-MM')}</Text><FilterButton label={t('reports.nextMonth')} onPress={() => setMonth((value) => addMonths(value, 1))} /></View>
      <FilterRow label={t('salary.byWorkplace')} options={[{ id: 'all', name: t('reports.all') }, ...workplaces]} selected={workplaceId} onSelect={setWorkplaceId} />
      <FilterRow label={t('salary.byRole')} options={[{ id: 'all', name: t('reports.all') }, ...roles.filter((role) => workplaceId === 'all' || role.workplaceId === workplaceId)]} selected={roleId} onSelect={setRoleId} />
      <FilterRow label={t('reports.status')} options={[{ id: 'all', name: t('reports.all') }, { id: 'completed', name: t('status.completed') }, { id: 'scheduled', name: t('status.scheduled') }]} selected={status} onSelect={setStatus} />
      {!loading && !filtered.length ? <EmptyState body={t('reports.emptyBody')} title={t('reports.empty')} /> : <View style={styles.metrics}>
        {summary.invalidCount > 0 ? (
          <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left', flexBasis: '100%', marginBottom: spacing.sm }}>
            {summary.invalidCount === 1 ? t('dashboard.invalidShiftsWarning_one') : t('dashboard.invalidShiftsWarning_other', { count: summary.invalidCount })}
          </Text>
        ) : null}
        <MetricCard label={t('reports.scheduledCount')} value={String(filtered.filter((shift) => shift.status === 'scheduled').length)} />
        <MetricCard label={t('reports.completedCount')} value={String(summary.completedCount)} />
        <MetricCard label={t('reports.workedMinutes')} value={formatDurationLong(summary.workedMinutes, locale)} />
        <MetricCard label={t('reports.upcomingMinutes')} value={formatDurationLong(summary.upcomingMinutes, locale)} />
        {salary.summary ? <><MetricCard label={t('home.earned')} value={formatCurrency(salary.summary.earnedMinor)} /><MetricCard label={t('home.future')} value={formatCurrency(salary.summary.futureMinor)} /><MetricCard emphasized label={t('home.forecast')} value={formatCurrency(salary.summary.forecastMinor)} /><MetricCard label={t('salary.basePay')} value={formatCurrency(salary.summary.basePayMinor)} /><MetricCard label={t('salary.premiumPay')} value={formatCurrency(salary.summary.premiumPayMinor)} /><MetricCard label={t('salary.minimumAdjustment')} value={formatCurrency(salary.summary.minimumAdjustmentsMinor)} /><MetricCard label={t('salary.bonuses')} value={formatCurrency(salary.summary.bonusesMinor)} /><MetricCard label={t('salary.reimbursements')} value={formatCurrency(salary.summary.reimbursementsMinor)} /><MetricCard label={t('salary.regularHours')} value={formatDurationLong(salary.summary.regularMinutes, locale)} /><MetricCard label={t('salary.specialHours')} value={formatDurationLong(salary.summary.specialRateMinutes, locale)} />{salary.summary.incompleteShiftCount ? <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left' }}>{salary.summary.incompleteShiftCount} {t('salary.incompleteCount')}</Text> : null}{salary.summary.staleShiftCount ? <Text accessibilityRole="alert" style={{ color: colors.warning, textAlign: isRtl ? 'right' : 'left' }}>{salary.summary.staleShiftCount} {t('salary.staleCount')}</Text> : null}<Breakdown title={t('salary.byWorkplace')} values={salary.summary.byWorkplace} label={(id) => workplaces.find((item) => item.id === id)?.name ?? id} /><Breakdown title={t('salary.byRole')} values={salary.summary.byRole} label={(id) => roles.find((item) => item.id === id)?.name ?? '—'} /><Breakdown title={t('salary.byMultiplier')} values={salary.summary.byMultiplier} label={(id) => `${Number(id) / 100}%`} /><Breakdown title={t('salary.byDate')} values={salary.summary.byDate} label={(id) => id} /></> : null}
      </View>}
    </AppScreen>
  );
}

function FilterButton({ label, onPress }: { label: string; onPress: () => void }) { const { colors } = useAppTheme(); return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choice, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{label}</Text></Pressable>; }
function FilterRow({ label, options, selected, onSelect }: { label: string; options: readonly { id: string; name: string }[]; selected: string; onSelect: (id: string) => void }) { const { colors } = useAppTheme(); const { isRtl } = useTranslation(); return <View style={styles.filter}><Text style={{ color: colors.text, fontWeight: '700', textAlign: isRtl ? 'right' : 'left' }}>{label}</Text><View style={[styles.navigation, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{options.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === item.id }} key={item.id} onPress={() => onSelect(item.id)} style={[styles.choice, { backgroundColor: colors.surface, borderColor: selected === item.id ? colors.primary : colors.border }]}><Text style={{ color: colors.text }}>{item.name}</Text></Pressable>)}</View></View>; }
function Breakdown({ title, values, label }: { title: string; values: Readonly<Record<string, { minutes: number; totalMinor: number }>>; label: (id: string) => string }) { const { colors } = useAppTheme(); const { formatCurrency, isRtl, locale } = useTranslation(); return <View style={[styles.breakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', textAlign: isRtl ? 'right' : 'left' }}>{title}</Text>{Object.entries(values).map(([id, value]) => <View key={id} style={[styles.breakdownRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><Text style={{ color: colors.text }}>{label(id)}</Text><Text style={{ color: colors.textMuted }}>{formatDurationLong(value.minutes, locale)} · {formatCurrency(value.totalMinor)}</Text></View>)}</View>; }
const styles = StyleSheet.create({ metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, navigation: { alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'space-between' }, choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md }, filter: { gap: spacing.xs }, breakdown: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, flexBasis: '100%', gap: spacing.sm, padding: spacing.md }, breakdownRow: { justifyContent: 'space-between', gap: spacing.sm } });
