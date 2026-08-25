import { StyleSheet, Text, View } from 'react-native';

import type { BreakSession, PayCalculationResult, Shift } from '@/domain/entities';
import { buildEndShiftReview } from '@/domain/services';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';

interface QuickClockOutReviewProps {
  shift: Shift;
  breaks: readonly BreakSession[];
  actualEnd: string;
  estimatedPay?: string;
  salaryResult?: PayCalculationResult;
  busy: boolean;
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onOpenSalarySettings?: () => void;
}

export function QuickClockOutReview({ shift, breaks, actualEnd, estimatedPay, salaryResult, busy, onSave, onEdit, onCancel, onOpenSalarySettings }: QuickClockOutReviewProps) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale, t } = useTranslation();
  const review = buildEndShiftReview(shift, breaks, actualEnd);
  const align = isRtl ? 'right' : 'left';
  const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone } as const;
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: shift.timezone } as const;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]} testID="e2e-clock-out-review">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>{t('end.quickTitle')}</Text>
      <Text style={[styles.row, { color: colors.text, textAlign: align }]}>{t('end.actualEndDate')}: {formatDate(actualEnd, dateOptions)}</Text>
      <Text style={[styles.row, { color: colors.text, textAlign: align }]}>{t('active.actualStart')}: {formatDate(shift.actualStart!, timeOptions)}</Text>
      <Text style={[styles.row, { color: colors.text, textAlign: align }]}>{t('end.actualEndTime')}: {formatDate(actualEnd, timeOptions)}</Text>
      <Text style={[styles.total, { color: colors.text, textAlign: align }]}>{t('end.totalWorked')}: {formatDurationLong(review.netActualMinutes, locale)}</Text>
      {estimatedPay ? <View style={styles.pay}>
        <Text style={[styles.row, { color: colors.textMuted, textAlign: align }]}>{t('end.estimatedPay')}</Text>
        <Text style={[styles.total, { color: colors.primary, textAlign: align }]}>{estimatedPay}</Text>
        <SalaryTrustDisclosure onOpenSalarySettings={onOpenSalarySettings} result={salaryResult} />
      </View> : null}
      <PrimaryButton disabled={busy} label={t('end.save')} onPress={onSave} testID="e2e-clock-out-save" />
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
