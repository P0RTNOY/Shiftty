import type { PayRule } from '@/domain/entities';

const PREFIX = 'special-interval-pay:';

export function specialIntervalPayRuleProfilePrefix(salaryProfileId: string): string {
  return `${PREFIX}${salaryProfileId}:`;
}

export function specialIntervalPayRuleId(salaryProfileId: string, intervalId: string): string {
  return `${specialIntervalPayRuleProfilePrefix(salaryProfileId)}${intervalId}`;
}

export function buildManagedSpecialIntervalPayRule(input: {
  existing?: PayRule;
  intervalId: string;
  multiplierBasisPoints: number;
  name: string;
  salaryProfileId: string;
  timestamp: string;
}): PayRule {
  return {
    id: specialIntervalPayRuleId(input.salaryProfileId, input.intervalId),
    salaryProfileId: input.salaryProfileId,
    name: input.name,
    priority: 0,
    conditions: [{ type: 'specialIntervalId', intervalId: input.intervalId }],
    effect: { type: 'multiplier', basisPoints: input.multiplierBasisPoints },
    premiumFamily: 'special_interval',
    canStack: false,
    isEnabled: true,
    createdAt: input.existing?.createdAt ?? input.timestamp,
    updatedAt: input.timestamp,
  };
}

export function isManagedSpecialIntervalPayRule(rule: PayRule, intervalId: string, salaryProfileId: string): boolean {
  return rule.id === specialIntervalPayRuleId(salaryProfileId, intervalId)
    && rule.salaryProfileId === salaryProfileId
    && rule.priority === 0
    && rule.conditions.length === 1
    && rule.conditions[0]?.type === 'specialIntervalId'
    && rule.conditions[0].intervalId === intervalId
    && rule.effect.type === 'multiplier'
    && rule.premiumFamily === 'special_interval'
    && !rule.canStack
    && rule.isEnabled;
}
