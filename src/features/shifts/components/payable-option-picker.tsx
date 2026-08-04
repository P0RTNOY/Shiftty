import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PayableSource } from '@/domain/entities';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';

export function PayableOptionPicker({ value, hasScheduledRange, onChange }: { value: PayableSource; hasScheduledRange: boolean; onChange: (value: PayableSource) => void }) {
  const { colors } = useAppTheme(); const { isRtl, t } = useTranslation();
  const options: { value: PayableSource; label: ReturnType<typeof useTranslation>['t'] extends (key: infer K) => string ? K : never }[] = [
    { value: 'actual', label: 'end.useActual' }, { value: 'scheduled', label: 'end.useScheduled' }, { value: 'rounded', label: 'end.useRounded' }, { value: 'manual', label: 'end.useManual' },
  ];
  return <View style={styles.container}>{options.map((option) => {
    const disabled = option.value === 'scheduled' && !hasScheduledRange;
    return <Pressable accessibilityLabel={t(option.label)} accessibilityRole="radio" accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} key={option.value} onPress={() => onChange(option.value)} style={[styles.option, { backgroundColor: colors.surface, borderColor: value === option.value ? colors.primary : colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' }, disabled && styles.disabled]}><View style={[styles.dot, { borderColor: colors.primary }, value === option.value && { backgroundColor: colors.primary }]} /><Text style={{ color: colors.text }}>{t(option.label)}</Text></Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({ container: { gap: spacing.xs }, option: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, minHeight: 48, padding: spacing.sm }, dot: { borderRadius: 8, borderWidth: 2, height: 16, width: 16 }, disabled: { opacity: 0.42 } });
