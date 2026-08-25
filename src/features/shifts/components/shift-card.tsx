import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Shift } from '@/domain/entities';
import { getEffectiveShiftRange } from '@/domain/services';
import { StatusBadge } from '@/features/shifts/components/status-badge';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

interface ShiftCardProps { shift: Shift; workplaceName: string; roleName?: string; templateName?: string; onPress: () => void; testID?: string }

export function ShiftCard({ shift, workplaceName, roleName, templateName, onPress, testID }: ShiftCardProps) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl } = useTranslation();
  const range = getEffectiveShiftRange(shift);
  const direction = isRtl ? 'row-reverse' : 'row';
  const textAlign = isRtl ? 'right' : 'left';
  const resolvedTypeName = shift.shiftTypeNameSnapshot ?? templateName;
  const crossesDate = formatLocalDateKey(range.start, shift.timezone) !== formatLocalDateKey(range.end, shift.timezone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.header, { flexDirection: direction }]}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text, textAlign }]}>{shift.title || resolvedTypeName || workplaceName}</Text>
          {shift.title || resolvedTypeName ? <Text style={[styles.meta, { color: colors.textMuted, textAlign }]}>{workplaceName}{roleName ? ` · ${roleName}` : ''}</Text> : null}
        </View>
        <StatusBadge status={shift.status} />
      </View>
      <Text style={[styles.time, { color: colors.text, textAlign }]}>
        {formatDate(range.start, { weekday: 'short', day: 'numeric', month: 'short', timeZone: shift.timezone })} · {formatDate(range.start, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}–{crossesDate ? `${formatDate(range.end, { weekday: 'short', timeZone: shift.timezone })} ` : ''}{formatDate(range.end, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, minHeight: 96, padding: spacing.md },
  header: { alignItems: 'flex-start', gap: spacing.sm, justifyContent: 'space-between' },
  titleBlock: { flex: 1, gap: spacing.xxs },
  title: { fontSize: typography.title, fontWeight: '700' },
  meta: { fontSize: typography.caption },
  time: { fontSize: typography.body, fontVariant: ['tabular-nums'], fontWeight: '600' },
});
