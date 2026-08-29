import { payRuleSchema, type PayRule } from '@/domain/entities';

export const WEEKLY_REST_PAY_RULE_ID_PREFIX = 'weekly-rest-pay:';

export interface WeeklyRestPayRuleClassification {
  managed?: PayRule;
  managedIdCollision?: PayRule;
  advanced: PayRule[];
}

export function weeklyRestPayRuleId(salaryProfileId: string): string {
  return `${WEEKLY_REST_PAY_RULE_ID_PREFIX}${salaryProfileId}`;
}

export function targetsWeeklyRest(rule: PayRule): boolean {
  return rule.conditions.some((condition) => condition.type === 'specialInterval'
    && condition.intervalTypes.includes('weekly_rest'));
}

export function isManagedWeeklyRestPayRule(rule: PayRule, salaryProfileId: string): boolean {
  const condition = rule.conditions[0];
  return rule.id === weeklyRestPayRuleId(salaryProfileId)
    && rule.salaryProfileId === salaryProfileId
    && rule.conditions.length === 1
    && condition?.type === 'specialInterval'
    && condition.intervalTypes.length === 1
    && condition.intervalTypes[0] === 'weekly_rest'
    && rule.effect.type === 'multiplier'
    && rule.premiumFamily === 'special_interval'
    && !rule.canStack
    && rule.isEnabled
    && rule.effectiveFrom === undefined
    && rule.effectiveTo === undefined;
}

export function classifyWeeklyRestPayRules(
  rules: readonly PayRule[],
  salaryProfileId: string,
): WeeklyRestPayRuleClassification {
  const managedId = weeklyRestPayRuleId(salaryProfileId);
  const candidate = rules.find((rule) => rule.id === managedId);
  const managed = candidate && isManagedWeeklyRestPayRule(candidate, salaryProfileId) ? candidate : undefined;
  return {
    managed,
    managedIdCollision: candidate && !managed ? candidate : undefined,
    advanced: rules.filter((rule) => targetsWeeklyRest(rule) && rule.id !== managed?.id),
  };
}

export function buildManagedWeeklyRestPayRule(input: {
  salaryProfileId: string;
  multiplierBasisPoints: number;
  name: string;
  timestamp: string;
  existing?: PayRule;
}): PayRule {
  if (input.existing && !isManagedWeeklyRestPayRule(input.existing, input.salaryProfileId)) {
    throw new Error('The managed weekly-rest pay-rule ID is already used by an incompatible rule.');
  }
  return payRuleSchema.parse({
    id: weeklyRestPayRuleId(input.salaryProfileId),
    salaryProfileId: input.salaryProfileId,
    name: input.existing?.name ?? input.name,
    priority: input.existing?.priority ?? 0,
    conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
    effect: { type: 'multiplier', basisPoints: input.multiplierBasisPoints },
    premiumFamily: 'special_interval',
    canStack: false,
    isEnabled: true,
    createdAt: input.existing?.createdAt ?? input.timestamp,
    updatedAt: input.timestamp,
  });
}
