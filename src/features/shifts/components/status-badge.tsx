import { StyleSheet, Text, View } from 'react-native';

import type { ShiftStatus } from '@/domain/entities';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';

export function StatusBadge({ status }: { status: ShiftStatus }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const statusColor = status === 'missed' ? colors.danger : status === 'cancelled' ? colors.textMuted : status === 'active' ? colors.warning : colors.success;
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: statusColor }]}>
      <Text style={[styles.text, { color: statusColor }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  text: { fontSize: 12, fontWeight: '700' },
});
