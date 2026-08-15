import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PayCalculationResult, SalaryCalculationStatus } from '@/domain/entities';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';

export function SalaryBreakdown({ result, status, onRecalculate }: { result?: PayCalculationResult; status: SalaryCalculationStatus; onRecalculate?: () => void }) {
  const { colors } = useAppTheme();
  const { formatCurrency, isRtl, locale, t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const align = isRtl ? 'right' : 'left';
  if (!result || result.totalGrossPayMinor === undefined) {
    return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
      <Text accessibilityRole="alert" style={[styles.title, { color: colors.warning, textAlign: align }]}>{t('salary.missingConfig')}</Text>
      {onRecalculate ? <PrimaryButton label={t('salary.recalculate')} onPress={onRecalculate} /> : null}
    </View>;
  }

  const statusKey = status === 'finalized' ? 'salary.finalized' : status === 'stale' ? 'salary.stale' : 'salary.estimateOnly';
  const summaryStatus = status === 'finalized' ? t('salary.finalPay') : status === 'stale' ? t('salary.stale') : t('salary.estimatedPay');
  const hasNoPayRules = result.issues.some((issue) => issue.code === 'no_pay_rules_configured');
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: status === 'stale' ? colors.warning : colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.summaryTitle')}</Text>
    <Text style={[styles.status, { color: status === 'stale' ? colors.warning : colors.textMuted, textAlign: align }]}>{summaryStatus}</Text>
    <Text style={[styles.total, { color: colors.primary, textAlign: align }]}>{formatCurrency(result.totalGrossPayMinor)}</Text>
    {hasNoPayRules ? <Text accessibilityRole="alert" style={[styles.warning, { color: colors.warning, textAlign: align }]}>{t('salary.noPayRules')}</Text> : null}
    <SecondaryButton label={showDetails ? t('salary.hideDetails') : t('salary.showDetails')} onPress={() => setShowDetails((value) => !value)} />

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
      {result.segments.map((segment) => <View key={`${segment.start}-${segment.end}`} style={[styles.segment, { borderTopColor: colors.border }]}><Text style={{ color: colors.text, textAlign: align }}>{formatDurationLong(segment.minutes, locale)} · {segment.multiplierBasisPoints / 100}%</Text><Text style={{ color: colors.textMuted, textAlign: align }}>{segment.labels.join(' + ') || t('salary.regularHours')} · {formatCurrency(segment.totalPayMinor)}</Text></View>)}
      {onRecalculate ? <PrimaryButton label={t('salary.recalculate')} onPress={onRecalculate} /> : null}
    </View> : null}
  </View>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  return <View style={[styles.row, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}><Text style={{ color: colors.textMuted }}>{label}</Text><Text style={{ color: colors.text, fontWeight: strong ? '800' : '600' }}>{value}</Text></View>;
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
