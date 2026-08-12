import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PayableSource } from '@/domain/entities';
import { buildEndShiftReview, selectPayableTime, type RoundingMode } from '@/domain/services';
import { PayableOptionPicker } from '@/features/shifts/components/payable-option-picker';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { AppScreen, DateField, FormField, PrimaryButton, SecondaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { formatLocalDateKey, formatLocalTime, resolveLocalDateTime, resolveLocalShiftRange } from '@/shared/utils/zoned-time';

export default function EndShiftReviewScreen() {
  const active = useActiveShift(); const shift = active.activeShift; const { t, locale, isRtl, formatDate } = useTranslation(); const { colors } = useAppTheme();
  const [capturedNow] = useState(() => new Date()); const [actualEndDate, setActualEndDate] = useState(() => formatLocalDateKey(capturedNow)); const [actualEndTime, setActualEndTime] = useState(() => formatLocalTime(capturedNow));
  const [source, setSource] = useState<PayableSource>('actual'); const [roundingMinutes, setRoundingMinutes] = useState<5 | 10 | 15 | 30>(15); const [roundingMode, setRoundingMode] = useState<RoundingMode>('nearest');
  const [manualStart, setManualStart] = useState(() => active.activeShift?.actualStart ? formatLocalTime(active.activeShift.actualStart, active.activeShift.timezone) : ''); const [manualEnd, setManualEnd] = useState(actualEndTime); const [manualBreak, setManualBreak] = useState('0'); const [closeOpenAtEnd, setCloseOpenAtEnd] = useState(false); const [error, setError] = useState<string | null>(null);
  const actualEnd = useMemo(() => { try { return shift ? resolveLocalDateTime(actualEndDate, actualEndTime, shift.timezone) : undefined; } catch { return undefined; } }, [actualEndDate, actualEndTime, shift]);
  const openBreak = active.breaks.find((item) => !item.end); let review: ReturnType<typeof buildEndShiftReview> | undefined;
  try { if (shift && actualEnd) review = buildEndShiftReview(shift, active.breaks, actualEnd); } catch { review = undefined; }
  const complete = async () => {
    if (!shift || !actualEnd || !review || (openBreak && !closeOpenAtEnd)) { setError(t('end.invalid')); return; }
    try {
      const manualRange = source === 'manual' ? resolveLocalShiftRange(formatLocalDateKey(shift.actualStart!, shift.timezone), manualStart, manualEnd, shift.timezone) : undefined;
      const payable = selectPayableTime({ shift, actualEnd, unpaidBreakMinutes: review.unpaidBreakMinutes, source, rounding: source === 'rounded' ? { incrementMinutes: roundingMinutes, mode: roundingMode } : undefined, manual: manualRange ? { start: manualRange.start, end: manualRange.end, breakMinutes: Number(manualBreak) } : undefined });
      const completed = await active.completeShift({ shiftId: shift.id, actualEnd, payableStart: payable.payableStart, payableEnd: payable.payableEnd, actualBreakMinutes: review.unpaidBreakMinutes, payableBreakMinutes: payable.payableBreakMinutes, payableSource: payable.payableSource, closeOpenBreak: Boolean(openBreak) });
      if (completed) router.replace(`/shifts/${completed.id}`);
    } catch { setError(t('end.invalid')); }
  };
  if (!shift) return <AppScreen title={t('end.title')}><SecondaryButton label={t('common.back')} onPress={() => router.back()} /><Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text></AppScreen>;
  return <AppScreen title={t('end.title')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    {openBreak ? <View style={[styles.warning, { backgroundColor: colors.surface, borderColor: colors.warning }]}><Text accessibilityRole="header" style={[styles.heading, { color: colors.warning }]}>{t('end.openBreakTitle')}</Text><Text style={{ color: colors.text }}>{t('end.openBreakBody')}</Text><PrimaryButton disabled={active.busy} label={t('end.endBreakNow')} onPress={() => void active.endBreak(new Date().toISOString()).catch(() => setError(t('end.invalid')))} /><SecondaryButton label={t('end.breakEndsWithShift')} onPress={() => setCloseOpenAtEnd(true)} /></View> : null}
    <DateField label={t('end.actualEndDate')} onChange={(value) => value && setActualEndDate(value)} value={actualEndDate} />
    <TimeField label={t('end.actualEndTime')} onChange={(value) => value && setActualEndTime(value)} value={actualEndTime} />
    {review ? <View style={[styles.review, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Summary label={t('end.scheduled')} value={review.scheduledMinutes === undefined ? '—' : formatDurationLong(review.scheduledMinutes, locale)} />
      <Summary label={t('end.actual')} value={formatDurationLong(review.actualMinutes, locale)} />
      <Summary label={t('active.paidBreaks')} value={formatDurationLong(review.paidBreakMinutes, locale)} />
      <Summary label={t('active.unpaidBreaks')} value={formatDurationLong(review.unpaidBreakMinutes, locale)} />
      <Summary label={t('end.netActual')} value={formatDurationLong(review.netActualMinutes, locale)} />
    </View> : <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('end.invalid')}</Text>}
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('end.payableChoice')}</Text>
    <PayableOptionPicker hasScheduledRange={Boolean(shift.scheduledStart && shift.scheduledEnd)} onChange={setSource} value={source} />
    {source === 'rounded' ? <><ChoiceRow values={[5,10,15,30] as const} selected={roundingMinutes} onSelect={setRoundingMinutes} label={(value) => `${value} ${t('active.minutes')}`} /><ChoiceRow values={['nearest','floor','ceiling'] as const} selected={roundingMode} onSelect={setRoundingMode} label={(value) => t(value === 'nearest' ? 'end.roundNearest' : value === 'floor' ? 'end.roundFloor' : 'end.roundCeiling')} /></> : null}
    {source === 'manual' ? <><TimeField label={t('end.manualStart')} onChange={(value) => value && setManualStart(value)} value={manualStart} /><TimeField label={t('end.manualEnd')} onChange={(value) => value && setManualEnd(value)} value={manualEnd} /><FormField keyboardType="number-pad" label={t('end.payableBreak')} onChangeText={setManualBreak} value={manualBreak} /></> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <PrimaryButton disabled={active.busy || !review || Boolean(openBreak && !closeOpenAtEnd)} label={t('end.complete')} onPress={() => void complete()} />
    <Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{t('active.actualStart')}: {formatDate(shift.actualStart!, { dateStyle: 'short', timeStyle: 'short', timeZone: shift.timezone })}</Text>
  </AppScreen>;
}

function Summary({ label, value }: { label: string; value: string }) { const { colors } = useAppTheme(); const { isRtl } = useTranslation(); return <View style={[styles.summary, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><Text style={{ color: colors.textMuted }}>{label}</Text><Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text></View>; }
function ChoiceRow<T extends string | number>({ values, selected, onSelect, label }: { values: readonly T[]; selected: T; onSelect: (value: T) => void; label: (value: T) => string }) { const { colors } = useAppTheme(); const { isRtl } = useTranslation(); return <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{values.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === value }} key={value} onPress={() => onSelect(value)} style={[styles.choice, { backgroundColor: colors.surface, borderColor: selected === value ? colors.primary : colors.border }]}><Text style={{ color: colors.text }}>{label(value)}</Text></Pressable>)}</View>; }
const styles = StyleSheet.create({ warning: { borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md }, review: { borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md }, summary: { justifyContent: 'space-between' }, heading: { fontSize: typography.title, fontWeight: '800' }, choices: { flexWrap: 'wrap', gap: spacing.xs }, choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md } });
