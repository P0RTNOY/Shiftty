import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Shift } from '@/domain/entities';
import { calculateShiftDuration, getEffectiveShiftRange } from '@/domain/services';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationCompact } from '@/shared/utils/duration-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

interface Props {
  shift: Shift;
  workplaceName: string;
  salaryMinor?: number;
  baseOnly?: boolean;
  onPress: () => void;
}

export function ReportShiftRow({ shift, workplaceName, salaryMinor, baseOnly = false, onPress }: Props) {
  const { colors } = useAppTheme();
  const { formatCurrency, formatDate, isRtl, locale, t } = useTranslation();
  const range = shift.status === 'completed' && shift.actualStart && shift.actualEnd
    ? { start: shift.actualStart, end: shift.actualEnd }
    : getEffectiveShiftRange(shift);
  const crossesDate = formatLocalDateKey(range.start, shift.timezone) !== formatLocalDateKey(range.end, shift.timezone);
  const durationKind = shift.status === 'completed' ? (shift.payableStart ? 'payable' : 'actual') : 'scheduled';
  let durationMinutes: number | undefined;
  try { durationMinutes = calculateShiftDuration(shift, durationKind)?.paidMinutes; } catch { durationMinutes = undefined; }
  const textAlign = isRtl ? 'right' : 'left';

  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}>
    <View style={[styles.topRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.date, { color: colors.text, textAlign }]}>{formatDate(range.start, { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: shift.timezone })}</Text>
        <Text style={[styles.workplace, { color: colors.textMuted, textAlign }]}>{workplaceName}</Text>
      </View>
      <Text style={[styles.salary, { color: salaryMinor === undefined ? colors.warning : colors.primary, textAlign }]}>{salaryMinor === undefined ? t('salary.missingConfig') : formatCurrency(salaryMinor)}</Text>
    </View>
    <Text style={[styles.time, { color: colors.text, textAlign }]}>{formatDate(range.start, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}–{crossesDate ? `${formatDate(range.end, { weekday: 'short', timeZone: shift.timezone })} ` : ''}{formatDate(range.end, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}</Text>
    <Text style={[styles.duration, { color: colors.textMuted, textAlign }]}>{durationMinutes === undefined ? '—' : formatDurationCompact(durationMinutes, locale)}</Text>
    {shift.salaryCalculationStatus === 'stale' ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign }]}>{t('salary.stale')}</Text> : null}
    {baseOnly ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign }]}>{t('salary.noPayRules')}</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, minHeight: 120, padding: spacing.md },
  topRow: { alignItems: 'flex-start', gap: spacing.sm, justifyContent: 'space-between' },
  titleBlock: { flex: 1, gap: spacing.xxs },
  date: { fontSize: typography.title, fontWeight: '800' },
  workplace: { fontSize: typography.caption },
  salary: { fontSize: typography.title, fontWeight: '800' },
  time: { fontSize: typography.body, fontVariant: ['tabular-nums'], fontWeight: '700' },
  duration: { fontSize: typography.body, fontWeight: '600' },
  warning: { fontSize: typography.caption, fontWeight: '700' },
});
