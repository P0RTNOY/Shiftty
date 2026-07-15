import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface MetricCardProps {
  label: string;
  value: string;
  emphasized?: boolean;
}

export function MetricCard({ label, value, emphasized = false }: MetricCardProps) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  const textAlign = isRtl ? 'right' : 'left';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: emphasized ? colors.surfaceMuted : colors.surface,
          borderColor: emphasized ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.textMuted, textAlign }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text, textAlign }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing.xs,
    minHeight: 112,
    padding: spacing.md,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 18,
  },
  value: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
});
