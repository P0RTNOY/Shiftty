import { StyleSheet, Text, View } from 'react-native';

import type { BreakSession, Shift } from '@/domain/entities';
import { buildEndShiftReview } from '@/domain/services';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';

interface QuickClockOutReviewProps {
  shift: Shift;
  breaks: readonly BreakSession[];
  actualEnd: string;
  estimatedPay?: string;
  busy: boolean;
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function QuickClockOutReview({ shift, breaks, actualEnd, estimatedPay, busy, onSave, onEdit, onCancel }: QuickClockOutReviewProps) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale, t } = useTranslation();
  const review = buildEndShiftReview(shift, breaks, actualEnd);
  const align = isRtl ? 'right' : 'left';
  const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone } as const;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>{t('end.quickTitle')}</Text>
      <Text style={[styles.row, { color: colors.text, textAlign: align }]}>{t('active.actualStart')}: {formatDate(shift.actualStart!, timeOptions)}</Text>
      <Text style={[styles.row, { color: colors.text, textAlign: align }]}>{t('end.actualEndTime')}: {formatDate(actualEnd, timeOptions)}</Text>
      <Text style={[styles.total, { color: colors.text, textAlign: align }]}>{t('end.totalWorked')}: {formatDurationLong(review.netActualMinutes, locale)}</Text>
      {estimatedPay ? <View style={styles.pay}>
        <Text style={[styles.row, { color: colors.textMuted, textAlign: align }]}>{t('end.estimatedPay')}</Text>
        <Text style={[styles.total, { color: colors.primary, textAlign: align }]}>{estimatedPay}</Text>
      </View> : null}
      <PrimaryButton disabled={busy} label={t('end.save')} onPress={onSave} />
      <SecondaryButton disabled={busy} label={t('end.editDetails')} onPress={onEdit} />
      <SecondaryButton disabled={busy} label={t('common.cancel')} onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 2, gap: spacing.sm, padding: spacing.lg },
  title: { fontSize: typography.heading, fontWeight: '800' },
  row: { fontSize: typography.body },
  total: { fontSize: typography.title, fontWeight: '800' },
  pay: { gap: spacing.xxs },
});
