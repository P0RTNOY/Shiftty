import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PayCalculationResult, SalaryCalculationStatus, SalaryTrustState } from '@/domain/entities';
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
  const { isRtl, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const trustState = mode === 'calculation' ? deriveSalaryTrustState(result, status) : undefined;
  const usesDefaultOvertime = result?.issues?.some((issue) => issue.code === 'default_overtime_applied') ?? false;
  const usesConfiguredWeeklyOvertime = result?.explanations?.some((explanation) => (
    explanation === 'salary.explanations.configured_weekly_overtime'
    || explanation.startsWith('salary.explanations.weekly_overtime:')
  )) ?? false;
  const align = isRtl ? 'right' : 'left';
  const includedKeys = resolveIncludedKeys(result, mode, usesDefaultOvertime, usesConfiguredWeeklyOvertime, trustState);
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
      style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.disclosureText, { color: colors.primary, textAlign: align }]}>
        {t(expanded ? 'salary.hideDetails' : 'salary.showDetails')}
      </Text>
    </Pressable>

    {expanded ? <View style={styles.details}>
      <AssumptionList title={t('salary.assumptionsIncluded')} translationKeys={includedKeys} />
      <AssumptionList title={t('salary.assumptionsNotModeled')} translationKeys={notModeledKeys} />
    </View> : null}
  </View>;
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
});
