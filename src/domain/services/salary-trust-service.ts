import type {
  PayCalculationResult,
  SalaryCalculationStatus,
  SalaryTrustState,
} from '@/domain/entities';
import {
  DEFAULT_OVERTIME_TIER_ONE_RULE_ID,
  DEFAULT_OVERTIME_TIER_TWO_RULE_ID,
} from '@/domain/services/salary-calculation-service';

const UNAVAILABLE_STATUSES: ReadonlySet<SalaryCalculationStatus> = new Set([
  'not_calculated',
  'incomplete',
  'stale',
]);

const DEFAULT_ASSUMPTION_ISSUES = new Set([
  'default_overtime_applied',
  'no_pay_rules_configured',
]);

/**
 * Classifies presentation trust without changing or persisting calculation data.
 * Unknown legacy provenance is deliberately classified as a basic estimate.
 */
export function deriveSalaryTrustState(
  result?: PayCalculationResult,
  status?: SalaryCalculationStatus,
): SalaryTrustState {
  if (
    !result
    || result.totalGrossPayMinor === undefined
    || result.issues?.some((issue) => issue.severity === 'error')
    || (status !== undefined && UNAVAILABLE_STATUSES.has(status))
  ) {
    return 'unavailable';
  }

  const usesDefaultAssumption = result.issues?.some((issue) => DEFAULT_ASSUMPTION_ISSUES.has(issue.code))
    || result.appliedRuleIds?.some((ruleId) => (
      ruleId === DEFAULT_OVERTIME_TIER_ONE_RULE_ID
      || ruleId === DEFAULT_OVERTIME_TIER_TWO_RULE_ID
    ));

  const usesConfiguredWeeklyOvertime = result.explanations?.some((explanation) => (
    explanation.startsWith('salary.explanations.weekly_overtime:')
    || explanation === 'salary.explanations.configured_weekly_overtime'
  ));

  const usesConfiguredSpecialInterval = result.specialIntervalEvaluations?.some((evaluation) => (
    evaluation.contributedToEstimate && evaluation.appliedRuleIds.length > 0
  )) ?? false;

  if (usesDefaultAssumption && !usesConfiguredWeeklyOvertime && !usesConfiguredSpecialInterval) return 'basic_estimate';

  // Only new results that explicitly record configured-overtime provenance are
  // promoted. Historical results without provenance remain conservative.
  return usesConfiguredSpecialInterval || result.explanations?.some((explanation) => (
    explanation === 'salary.explanations.configured_overtime'
    || explanation === 'salary.explanations.configured_weekly_overtime'
    || explanation.startsWith('salary.explanations.weekly_overtime:')
  ))
    ? 'configured_estimate'
    : 'basic_estimate';
}
