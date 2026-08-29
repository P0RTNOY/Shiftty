import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PayCalculationResult, SalaryCalculationStatus } from '@/domain/entities';
import {
  DEFAULT_OVERTIME_TIER_ONE_RULE_NAME,
  DEFAULT_OVERTIME_TIER_TWO_RULE_NAME,
  PROFILE_WEEKLY_OVERTIME_RULE_NAME,
  deriveSalaryTrustState,
} from '@/domain/services';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';

export function SalaryBreakdown({ result, status, onRecalculate, onOpenSalarySettings }: { result?: PayCalculationResult; status: SalaryCalculationStatus; onRecalculate?: () => void; onOpenSalarySettings?: () => void }) {
  const { colors } = useAppTheme();
  const { formatCurrency, isRtl, locale, t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const align = isRtl ? 'right' : 'left';
  const exceedsMaximumDuration = result?.issues.some((issue) => issue.code === 'shift_duration_exceeds_maximum');
  const trustState = deriveSalaryTrustState(result, status);
  if (trustState === 'unavailable' || !result || result.totalGrossPayMinor === undefined) {
    return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warning }]} testID="e2e-salary-unavailable-or-stale">
      <Text accessibilityRole="alert" style={[styles.title, { color: colors.warning, textAlign: align }]}>{t(status === 'stale' ? 'salary.stale' : 'salary.trustUnavailable')}</Text>
      {exceedsMaximumDuration ? <Text style={[styles.warning, { color: colors.warning, textAlign: align }]}>{t('salary.issues.shiftDurationExceedsMaximum')}</Text> : null}
      {onRecalculate ? <PrimaryButton label={t('salary.recalculate')} onPress={onRecalculate} testID="e2e-salary-recalculate" /> : null}
      <SalaryTrustDisclosure onOpenSalarySettings={onOpenSalarySettings} result={result} showTrustState={false} status={status} />
    </View>;
  }

  const statusKey = status === 'finalized' ? 'salary.finalized' : status === 'stale' ? 'salary.stale' : 'salary.estimateOnly';
  const summaryStatus = t('salary.estimatedPay');
  const hasLegacyBaseOnlyCalculation = result.issues.some((issue) => issue.code === 'no_pay_rules_configured');
  const shiftTypeMultiplier = result.shiftTypeMultiplierBasisPoints ?? 10_000;
  const weeklyRuleLabel = resolveWeeklyRuleLabel(result, locale, t);
  const effectiveShiftTypeRate = result.resolvedBaseHourlyRateMinor === undefined
    ? undefined
    : Math.round(result.resolvedBaseHourlyRateMinor * shiftTypeMultiplier / 10_000);
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: status === 'stale' ? colors.warning : colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.summaryTitle')}</Text>
    <Text style={[styles.status, { color: status === 'stale' ? colors.warning : colors.textMuted, textAlign: align }]}>{summaryStatus}</Text>
    <Text accessibilityLabel={String(result.totalGrossPayMinor)} style={[styles.total, { color: colors.primary, textAlign: align }]} testID="e2e-salary-total">{formatCurrency(result.totalGrossPayMinor)}</Text>
    {result.shiftTypeName ? <Row label={t('salary.shiftType')} value={result.shiftTypeName} /> : null}
    <Row label={t('salary.workingHours')} value={formatDurationLong(result.payableMinutes, locale)} />
    {result.resolvedBaseHourlyRateMinor !== undefined ? <Row label={t('salary.baseHourlyRate')} value={formatCurrency(result.resolvedBaseHourlyRateMinor)} /> : null}
    <Row label={t('salary.shiftTypeMultiplier')} value={`${shiftTypeMultiplier / 100}%`} />
    {effectiveShiftTypeRate !== undefined ? <Row label={t('salary.effectiveHourlyRate')} value={formatCurrency(effectiveShiftTypeRate)} /> : null}
    {hasLegacyBaseOnlyCalculation ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign: align }]}>{t('salary.noPayRules')}</Text> : null}
    {hasLegacyBaseOnlyCalculation && onRecalculate ? <PrimaryButton label={t('salary.applyDefaultOvertime')} onPress={onRecalculate} /> : null}
    <SalaryTrustDisclosure onOpenSalarySettings={onOpenSalarySettings} result={result} status={status} />
    <SecondaryButton label={showDetails ? t('salary.hideBreakdown') : t('salary.showBreakdown')} onPress={() => setShowDetails((value) => !value)} testID="e2e-salary-breakdown-toggle" />

    {showDetails ? <View style={styles.details}>
      <Text accessibilityLabel={t(statusKey)} style={{ color: status === 'stale' ? colors.warning : colors.textMuted, textAlign: align }}>{t(statusKey)}</Text>
      <Row label={t('salary.basePay')} value={formatCurrency(result.basePayMinor)} />
      <Row label={t('salary.premiumPay')} value={formatCurrency(result.premiumPayMinor)} />
      <Row label={t('salary.minimumAdjustment')} value={formatCurrency(result.minimumDurationAdjustmentMinor)} />
      <Row label={t('salary.bonuses')} value={formatCurrency(result.fixedBonusesMinor)} />
      <Row label={t('salary.reimbursements')} value={formatCurrency(result.reimbursementsMinor)} />
      <Row strong label={t('salary.totalGross')} value={formatCurrency(result.totalGrossPayMinor)} />
      <Row label={t('salary.regularHours')} value={formatDurationLong(result.regularMinutes, locale)} />
      <Row label={t('salary.specialHours')} value={formatDurationLong(result.specialRateMinutes, locale)} />
      {result.segments.map((segment) => {
        const evidenceNames = (result.specialIntervalEvaluations ?? [])
          .filter((evaluation) => segment.specialIntervalIds?.includes(evaluation.intervalId))
          .map((evaluation) => evaluation.name);
        const ruleLabels = segment.labels.map((label) => label === DEFAULT_OVERTIME_TIER_ONE_RULE_NAME
          ? t('salary.defaultOvertimeTierOneName')
          : label === DEFAULT_OVERTIME_TIER_TWO_RULE_NAME
            ? t('salary.defaultOvertimeTierTwoName')
            : label === PROFILE_WEEKLY_OVERTIME_RULE_NAME
              ? weeklyRuleLabel
              : label);
        const segmentTestId = ruleLabels.includes(weeklyRuleLabel)
          ? 'e2e-weekly-overtime-segment'
          : segment.labels.some((label) => label === DEFAULT_OVERTIME_TIER_ONE_RULE_NAME || label === DEFAULT_OVERTIME_TIER_TWO_RULE_NAME)
            ? 'e2e-default-overtime-segment'
            : undefined;
        return <View key={`${segment.start}-${segment.end}`} style={[styles.segment, { borderTopColor: colors.border }]} testID={segmentTestId}>
          <Text style={{ color: colors.text, textAlign: align }}>{formatDurationLong(segment.minutes, locale)} · {segment.multiplierBasisPoints / 100}%</Text>
          <Text style={{ color: colors.textMuted, textAlign: align }}>{ruleLabels.join(' + ') || t('salary.regularHours')} · {formatCurrency(segment.totalPayMinor)}</Text>
          {evidenceNames.length > 0 ? <Text testID="salary-segment-special-intervals" style={{ color: colors.textMuted, textAlign: align }}>{evidenceNames.join(' · ')}</Text> : null}
        </View>;
      })}
      {onRecalculate ? <PrimaryButton label={t('salary.recalculate')} onPress={onRecalculate} testID="e2e-salary-recalculate" /> : null}
    </View> : null}
  </View>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  return <View style={[styles.row, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><Text style={{ color: colors.textMuted }}>{label}</Text><Text style={{ color: colors.text, fontWeight: strong ? '800' : '600' }}>{value}</Text></View>;
}

function resolveWeeklyRuleLabel(
  result: PayCalculationResult,
  locale: 'he' | 'en',
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const explanation = result.explanations.find((item) => item.startsWith('salary.explanations.weekly_overtime:'));
  if (!explanation) return t('salary.weeklyOvertimeRuleName');
  const parts = explanation.split(':');
  const regularMinutes = Number(parts.at(-3));
  const multiplierBasisPoints = Number(parts.at(-2));
  if (!Number.isFinite(regularMinutes) || !Number.isFinite(multiplierBasisPoints)) return t('salary.weeklyOvertimeRuleName');
  return t('salary.weeklyOvertimeSegment', {
    threshold: formatDurationLong(regularMinutes, locale),
    multiplier: multiplierBasisPoints / 100,
  });
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  title: { fontSize: typography.title, fontWeight: '800' },
  status: { fontSize: typography.body, fontWeight: '700' },
  total: { fontSize: typography.heading, fontWeight: '800' },
  warning: { fontSize: typography.body, fontWeight: '700' },
  details: { gap: spacing.sm },
  row: { justifyContent: 'space-between', gap: spacing.sm },
  segment: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, paddingTop: spacing.sm },
});
