import { StyleSheet, Text, View } from 'react-native';

import type { SalaryProfile } from '@/domain/entities';
import type { SalarySettingsOverview, SalarySetupStatus } from '@/features/pay-rules/services/salary-settings-overview';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatMinorUnits } from '@/shared/utils/money';

interface Props {
  onEdit: () => void;
  onOpenSpecialPay: () => void;
  overview: SalarySettingsOverview;
  profile: SalaryProfile;
  workplaceName: string;
}

export function SalaryWorkplaceOverview({ onEdit, onOpenSpecialPay, overview, profile, workplaceName }: Props) {
  const { colors } = useAppTheme();
  const { isRtl, locale, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';
  const weeklyOvertime = profile.weeklyOvertimeEnabled
    ? t('salary.overviewWeeklyOvertime', {
      hours: formatHours(profile.weeklyRegularMinutes ?? 0),
      multiplier: String((profile.weeklyOvertimeMultiplierBasisPoints ?? 10_000) / 100),
    })
    : statusLabel(overview.overtimeStatus, t);
  const weeklyRest = overview.weeklyRestRateBasisPoints
    ? t('salary.overviewSpecialRate', { multiplier: String(overview.weeklyRestRateBasisPoints / 100) })
    : statusLabel(overview.weeklyRestStatus, t);
  const holidays = overview.holidayStatus === 'configured'
    ? t('salary.overviewHolidayCount', { count: String(overview.holidayIntervalCount) })
    : statusLabel(overview.holidayStatus, t);

  return <View testID="salary-workplace-overview" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>{workplaceName}</Text>
    <Text style={[styles.profile, { color: colors.textMuted, textAlign: align }]}>{profile.name}</Text>
    <OverviewRow label={t('salary.hourlyRate')} value={formatMinorUnits(profile.baseHourlyRateMinor, profile.currency, locale)} />
    <OverviewRow label={t('salary.overviewOvertime')} value={weeklyOvertime} />
    <OverviewRow label={t('salary.weeklyRestTitle')} value={weeklyRest} />
    <OverviewRow label={t('salary.overviewHolidays')} value={holidays} />
    <PrimaryButton label={t('salary.editSettings')} onPress={onEdit} testID="e2e-salary-profile-edit" />
    <SecondaryButton label={t('salary.holidaysRestTitle')} onPress={onOpenSpecialPay} testID="e2e-salary-evidence" />
  </View>;
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  return <View style={[styles.row, { borderColor: colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
    <Text style={[styles.label, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{label}</Text>
    <Text style={[styles.value, { color: colors.text, textAlign: isRtl ? 'left' : 'right' }]}>{value}</Text>
  </View>;
}

function statusLabel(status: SalarySetupStatus, t: ReturnType<typeof useTranslation>['t']): string {
  if (status === 'configured') return t('salary.overviewConfigured');
  if (status === 'needs_attention') return t('salary.overviewNeedsAttention');
  return t('salary.overviewNotConfigured');
}

function formatHours(minutes: number): string {
  return Number.isInteger(minutes / 60) ? String(minutes / 60) : String(Number((minutes / 60).toFixed(2)));
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md },
  title: { fontSize: typography.title, fontWeight: '800' },
  profile: { fontSize: typography.body },
  row: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.md, justifyContent: 'space-between', minHeight: 48, paddingTop: spacing.sm },
  label: { flex: 1 },
  value: { flex: 1, fontWeight: '700', writingDirection: 'ltr' },
});
