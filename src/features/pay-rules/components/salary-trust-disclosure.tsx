import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  PayCalculationResult,
  SalaryCalculationStatus,
  SalaryTrustState,
  SpecialIntervalEvaluation,
} from '@/domain/entities';
import { deriveSalaryTrustState } from '@/domain/services';
import { SecondaryButton } from '@/shared/components';
import { useTranslation, type TranslationKey } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface SalaryTrustDisclosureProps {
  mode?: 'calculation' | 'generic';
  result?: PayCalculationResult;
  status?: SalaryCalculationStatus;
  onOpenSalarySettings?: () => void;
}

export function SalaryTrustDisclosure({
  mode = 'calculation',
  result,
  status,
  onOpenSalarySettings,
}: SalaryTrustDisclosureProps) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const trustState = mode === 'calculation' ? deriveSalaryTrustState(result, status) : undefined;
  const usesDefaultOvertime = result?.issues?.some((issue) => issue.code === 'default_overtime_applied') ?? false;
  const usesConfiguredWeeklyOvertime = result?.explanations?.some((explanation) => (
    explanation === 'salary.explanations.configured_weekly_overtime'
    || explanation.startsWith('salary.explanations.weekly_overtime:')
  )) ?? false;
  const align = isRtl ? 'right' : 'left';
  const includedKeys = resolveIncludedKeys(result, mode, usesDefaultOvertime, usesConfiguredWeeklyOvertime, trustState);
  const specialIntervals = mode === 'calculation' ? result?.specialIntervalEvaluations ?? [] : [];
  const notModeledKeys: TranslationKey[] = [
    ...(usesConfiguredWeeklyOvertime ? [] : ['salary.assumptionWeeklyOvertime'] as const),
    'salary.assumptionAutomaticHolidays',
    'salary.assumptionEmployerAgreements',
    'salary.assumptionNetPay',
  ];

  return <View
    testID="salary-trust-disclosure"
    style={[styles.container, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
  >
    {trustState ? <Text style={[styles.state, { color: trustState === 'unavailable' ? colors.warning : colors.text, textAlign: align }]}>
      {t(trustState === 'unavailable' ? 'salary.trustUnavailable' : trustState === 'basic_estimate' ? 'salary.trustBasic' : 'salary.trustConfigured')}
    </Text> : null}
    <Text style={[styles.intro, { color: colors.textMuted, textAlign: align }]}>{t('salary.basedOnSettings')}</Text>
    {usesDefaultOvertime && trustState !== 'unavailable' ? <View style={styles.defaultAssumption}>
      <Text style={[styles.explanation, { color: colors.text, textAlign: align }]}>{t('salary.defaultOvertimeApplied')}</Text>
      {onOpenSalarySettings ? <SecondaryButton label={t('salary.openSettings')} onPress={onOpenSalarySettings} /> : null}
    </View> : null}
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      testID="e2e-salary-trust-toggle"
      style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.disclosureText, { color: colors.primary, textAlign: align }]}>
        {t(expanded ? 'salary.hideDetails' : 'salary.showDetails')}
      </Text>
    </Pressable>

    {expanded ? <View style={styles.details}>
      <AssumptionList title={t('salary.assumptionsIncluded')} translationKeys={includedKeys} />
      {specialIntervals.length > 0 ? <View testID="salary-special-intervals" style={styles.list}>
        <Text style={[styles.listTitle, { color: colors.text, textAlign: align }]}>{t('salary.specialIntervalsIncluded')}</Text>
        {status === 'stale' ? <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalStoredPrevious')}</Text> : null}
        {specialIntervals.map((evaluation) => <SpecialIntervalDetail
          evaluation={evaluation}
          formatDate={formatDate}
          key={`${evaluation.intervalId}:${evaluation.start}:${evaluation.end}`}
          result={result!}
        />)}
      </View> : null}
      <AssumptionList title={t('salary.assumptionsNotModeled')} translationKeys={notModeledKeys} />
    </View> : null}
  </View>;
}

function SpecialIntervalDetail({
  evaluation,
  formatDate,
  result,
}: {
  evaluation: SpecialIntervalEvaluation;
  formatDate: ReturnType<typeof useTranslation>['formatDate'];
  result: PayCalculationResult;
}) {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';
  const sourceKey = evaluation.sourceKind === 'manual'
    ? 'salary.specialIntervalManual'
    : evaluation.sourceKind === 'confirmed_preset'
      ? 'salary.specialIntervalConfirmedPreset'
      : 'salary.specialIntervalImported';
  const typeKey = evaluation.type === 'holiday'
    ? 'salary.specialIntervalTypeHoliday'
    : evaluation.type === 'weekly_rest'
      ? 'salary.specialIntervalTypeWeeklyRest'
      : 'salary.specialIntervalTypeCustom';
  const rangeOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: evaluation.timezone,
  };
  const multipliers = [...new Set(result.segments
    .filter((segment) => segment.specialIntervalIds?.includes(evaluation.intervalId)
      && segment.appliedRuleIds.some((ruleId) => evaluation.appliedRuleIds.includes(ruleId)))
    .map((segment) => segment.multiplierBasisPoints))]
    .sort((left, right) => left - right);
  const effectKey = evaluation.appliedRuleIds.length === 0
    ? 'salary.specialIntervalNoRule'
    : evaluation.contributedToEstimate
      ? 'salary.specialIntervalContributed'
      : 'salary.specialIntervalNoContribution';

  return <View testID="salary-special-interval-detail" style={[styles.interval, { borderColor: colors.border }]}>
    <Text style={[styles.intervalTitle, { color: colors.text, textAlign: align }]}>{t(typeKey)}: {evaluation.name}</Text>
    <Text testID="salary-special-interval-range" style={[styles.machineText, { color: colors.textMuted, textAlign: 'left' }]}>{t('salary.specialIntervalRange', {
      start: formatDate(evaluation.start, rangeOptions),
      end: formatDate(evaluation.end, rangeOptions),
      timezone: evaluation.timezone,
    })}</Text>
    <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t(sourceKey)}</Text>
    <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalConfirmedAt', {
      date: isolateLtr(formatDate(evaluation.confirmedAt, {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: evaluation.timezone,
      })),
    })}</Text>
    {evaluation.sourceTitle ? <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalSource', { source: evaluation.sourceTitle })}</Text> : null}
    {evaluation.sourceUrl ? <Text
      accessibilityLabel={evaluation.sourceUrl}
      selectable
      style={[styles.sourceUrl, { color: colors.primary }]}
    >{evaluation.sourceUrl}</Text> : null}
    {evaluation.presetId && evaluation.presetVersion ? <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalPreset', {
      id: isolateLtr(evaluation.presetId),
      version: isolateLtr(evaluation.presetVersion),
    })}</Text> : null}
    {evaluation.appliedRuleIds.length > 0 ? <Text style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalRule')}</Text> : null}
    {evaluation.appliedRuleIds.map((ruleId) => <Text key={ruleId} style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalAppliedRule', {
      id: isolateLtr(ruleId),
    })}</Text>)}
    {multipliers.length > 0 ? <Text testID="salary-special-interval-multiplier" style={[styles.intervalText, { color: colors.textMuted, textAlign: align }]}>{t('salary.specialIntervalCombinedMultiplier', {
      multiplier: isolateLtr(multipliers.map((basisPoints) => basisPoints / 100).join(', ')),
    })}</Text> : null}
    <Text style={[styles.intervalEffect, { color: colors.text, textAlign: align }]}>{t(effectKey)}</Text>
  </View>;
}

function isolateLtr(value: string): string {
  return `\u2066${value}\u2069`;
}

function resolveIncludedKeys(
  result: PayCalculationResult | undefined,
  mode: 'calculation' | 'generic',
  usesDefaultOvertime: boolean,
  usesConfiguredWeeklyOvertime: boolean,
  trustState: SalaryTrustState | undefined,
): TranslationKey[] {
  if (mode === 'generic' || !result) return [
    'salary.assumptionHourlyRate',
    'salary.assumptionWorkingRange',
    'salary.assumptionBreaks',
    'salary.assumptionShiftType',
    'salary.assumptionOvertime',
    'salary.assumptionExtras',
  ];

  const keys: TranslationKey[] = [];
  if (result.resolvedBaseHourlyRateMinor !== undefined) keys.push('salary.assumptionHourlyRate');
  keys.push('salary.assumptionWorkingRange', 'salary.assumptionBreaks');
  if (result.shiftTypeName || (result.shiftTypeMultiplierBasisPoints ?? 10_000) !== 10_000) keys.push('salary.assumptionShiftType');
  keys.push(usesDefaultOvertime
    ? 'salary.assumptionDefaultOvertime'
    : trustState === 'configured_estimate'
      ? 'salary.assumptionConfiguredOvertime'
      : 'salary.assumptionOvertime');
  if (usesConfiguredWeeklyOvertime) keys.push('salary.assumptionConfiguredWeeklyOvertime');
  if (result.fixedBonusesMinor > 0 || result.reimbursementsMinor > 0) keys.push('salary.assumptionExtras');
  return keys;
}

function AssumptionList({ title, translationKeys }: { title: string; translationKeys: readonly TranslationKey[] }) {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';
  return <View style={styles.list}>
    <Text style={[styles.listTitle, { color: colors.text, textAlign: align }]}>{title}</Text>
    {translationKeys.map((key) => <View key={key} testID="salary-assumption-row" style={[styles.item, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
      <Text style={[styles.itemText, { color: colors.textMuted, textAlign: align }]}>{t(key)}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md },
  state: { fontSize: typography.body, fontWeight: '800' },
  intro: { fontSize: typography.body, lineHeight: 22 },
  defaultAssumption: { gap: spacing.sm },
  explanation: { fontSize: typography.body, lineHeight: 22 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: 'center', paddingTop: spacing.sm },
  disclosureText: { fontSize: typography.body, fontWeight: '800' },
  details: { gap: spacing.md },
  list: { gap: spacing.xs },
  listTitle: { fontSize: typography.body, fontWeight: '800' },
  item: { alignItems: 'flex-start', gap: spacing.xs },
  bullet: { fontSize: typography.body, lineHeight: 22 },
  itemText: { flex: 1, flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  interval: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, padding: spacing.sm },
  intervalText: { flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  machineText: { flexShrink: 1, fontSize: typography.body, fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  intervalTitle: { flexShrink: 1, fontSize: typography.body, fontWeight: '800', lineHeight: 22 },
  intervalEffect: { flexShrink: 1, fontSize: typography.body, fontWeight: '700', lineHeight: 22 },
  sourceUrl: { flexShrink: 1, fontSize: typography.caption, lineHeight: 20, textAlign: 'left', writingDirection: 'ltr' },
});
