import { Alert, StyleSheet, Text, View } from 'react-native';

import type { Shift } from '@/domain/entities';
import { calculateShiftDuration, canMarkShiftMissed } from '@/domain/services';
import { StatusBadge } from '@/features/shifts/components/status-badge';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

interface Props {
  shift: Shift;
  workplaceName: string;
  roleName?: string;
  templateName?: string;
  now?: Date;
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onMarkMissed: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onStart?: () => void;
  onManageBreaks?: () => void;
  onCancelTracking?: () => void;
}

export function ShiftDetailView({ shift, workplaceName, roleName, templateName, now = new Date(), ...actions }: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';
  const baseDate = shift.scheduledStart ?? shift.actualStart ?? shift.payableStart!;
  const eligibleForMissed = canMarkShiftMissed(shift, now);
  const confirmDelete = () => Alert.alert(t('shift.deleteTitle'), t('shift.deleteBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: actions.onDelete },
  ]);

  return <View style={styles.container}>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <StatusBadge status={shift.status} />
        <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{shift.title || templateName || workplaceName}</Text>
        <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{workplaceName}{roleName ? ` · ${roleName}` : ''}</Text>
        <Text style={[styles.date, { color: colors.text, textAlign: align }]}>{formatDate(baseDate, { dateStyle: 'full', timeZone: shift.timezone })}</Text>
      </View>
      <RangeRow label={t('shift.scheduledRange')} shift={shift} kind="scheduled" />
      <RangeRow label={t('shift.actualRange')} shift={shift} kind="actual" />
      <RangeRow label={t('shift.payableRange')} shift={shift} kind="payable" />
      <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t('shift.breaks')}: {shift.payableBreakMinutes ?? shift.actualBreakMinutes ?? shift.expectedBreakMinutes} {t('active.minutes')}</Text>
      {shift.recurrenceGroupId ? <Text style={[styles.meta, { color: colors.primary, textAlign: align }]}>{t('recurrence.series')}</Text> : null}
      {shift.notes ? <Text style={[styles.notes, { color: colors.text, textAlign: align }]}>{shift.notes}</Text> : null}
      <Text style={[styles.timestamp, { color: colors.textMuted, textAlign: align }]}>{t('shift.createdAt')}: {formatDate(shift.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</Text>
      <Text style={[styles.timestamp, { color: colors.textMuted, textAlign: align }]}>{t('shift.updatedAt')}: {formatDate(shift.updatedAt, { dateStyle: 'short', timeStyle: 'short' })}</Text>
    </View>
    {shift.status !== 'active' ? <>
      <PrimaryButton label={t('common.edit')} onPress={actions.onEdit} />
      <SecondaryButton label={t('common.duplicate')} onPress={actions.onDuplicate} />
    </> : null}
    {shift.status === 'scheduled' ? <PrimaryButton label={t('active.startScheduled')} onPress={() => actions.onStart?.()} /> : null}
    {shift.status === 'active' ? <PrimaryButton label={t('active.endShift')} onPress={() => actions.onStart?.()} /> : null}
    {shift.status === 'active' || shift.status === 'completed' ? <SecondaryButton label={t('active.manageBreaks')} onPress={() => actions.onManageBreaks?.()} /> : null}
    {shift.status === 'active' ? <SecondaryButton destructive label={t('active.cancelTracking')} onPress={() => actions.onCancelTracking?.()} /> : null}
    {shift.status === 'scheduled' && !eligibleForMissed ? <SecondaryButton destructive label={t('shift.cancelAction')} onPress={actions.onCancel} /> : null}
    {eligibleForMissed ? <SecondaryButton destructive label={t('shift.markMissed')} onPress={actions.onMarkMissed} /> : null}
    {shift.status === 'cancelled' || shift.status === 'missed' ? <SecondaryButton label={t('shift.restore')} onPress={actions.onRestore} /> : null}
    {shift.status !== 'active' ? <SecondaryButton destructive label={t('common.delete')} onPress={confirmDelete} /> : null}
  </View>;
}

function RangeRow({ label, shift, kind }: { label: string; shift: Shift; kind: 'scheduled' | 'actual' | 'payable' }) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale } = useTranslation();
  const start = shift[`${kind}Start`];
  const end = shift[`${kind}End`];
  let duration: ReturnType<typeof calculateShiftDuration> = null;
  if (start && end) duration = calculateShiftDuration(shift, kind);
  const crossesDate = Boolean(start && end && formatLocalDateKey(start, shift.timezone) !== formatLocalDateKey(end, shift.timezone));
  const value = start && end ? `${formatDate(start, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}–${crossesDate ? `${formatDate(end, { weekday: 'short', timeZone: shift.timezone })} ` : ''}${formatDate(end, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}` : '—';
  return <View style={[styles.range, { borderTopColor: colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
    <View style={styles.rangeText}><Text style={[styles.label, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{label}</Text><Text style={[styles.value, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{value}</Text></View>
    <Text style={[styles.duration, { color: colors.textMuted }]}>{duration ? formatDurationLong(duration.paidMinutes, locale) : '—'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm }, card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  heading: { gap: spacing.xs }, title: { fontSize: typography.heading, fontWeight: '800' }, meta: { fontSize: typography.body }, date: { fontSize: typography.title, fontWeight: '700' },
  range: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm, justifyContent: 'space-between', paddingTop: spacing.md },
  rangeText: { flex: 1, gap: spacing.xxs }, label: { fontSize: typography.caption, fontWeight: '700' }, value: { fontSize: typography.title, fontVariant: ['tabular-nums'], fontWeight: '700' }, duration: { fontSize: typography.caption },
  notes: { fontSize: typography.body, lineHeight: 24 }, timestamp: { fontSize: typography.caption },
});
