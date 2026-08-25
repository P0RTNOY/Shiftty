import { z } from 'zod';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const payRuleConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weekday'), weekdays: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ type: z.literal('timeWindow'), startTime: localTimeSchema, endTime: localTimeSchema }).refine((value) => value.startTime !== value.endTime, { message: 'Time-window boundaries must differ.' }),
  z.object({ type: z.literal('date'), date: z.iso.date() }),
  z.object({ type: z.literal('workplace'), workplaceId: z.string().min(1) }),
  z.object({ type: z.literal('role'), roleId: z.string().min(1) }),
  z.object({ type: z.literal('minimumDuration'), minutes: z.number().int().positive() }),
  z.object({ type: z.literal('holiday') }),
  z.object({
    type: z.literal('specialInterval'),
    intervalTypes: z.array(z.enum(['holiday', 'weekly_rest', 'custom'])).min(1)
      .refine((values) => new Set(values).size === values.length, { message: 'Special-interval types must be unique.' }),
  }),
  z.object({
    type: z.literal('weekend'),
    startWeekday: z.number().int().min(0).max(6),
    startTime: localTimeSchema,
    endWeekday: z.number().int().min(0).max(6),
    endTime: localTimeSchema,
  }).refine((value) => value.startWeekday !== value.endWeekday || value.startTime !== value.endTime, { message: 'Weekend-window boundaries must differ.' }),
  z.object({
    type: z.literal('workedMinutes'),
    afterMinutes: z.number().int().min(0),
    beforeMinutes: z.number().int().positive().optional(),
    scope: z.enum(['shift', 'day', 'week']),
    basis: z.enum(['gross', 'net']).optional(),
  }).refine((value) => value.beforeMinutes === undefined || value.beforeMinutes > value.afterMinutes, { message: 'Worked-minute upper bound must exceed its lower bound.' }),
]);

export type PayRuleCondition = z.infer<typeof payRuleConditionSchema>;

export const payRuleSchema = z.object({
  id: z.string().min(1),
  salaryProfileId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  priority: z.number().int(),
  conditions: z.array(payRuleConditionSchema),
  effect: z.discriminatedUnion('type', [
    z.object({ type: z.literal('multiplier'), basisPoints: z.number().int().min(10_000) }),
    z.object({ type: z.literal('fixedBonus'), amountMinor: z.number().int().min(0) }),
    z.object({ type: z.literal('reimbursement'), amountMinor: z.number().int().min(0) }),
    z.object({ type: z.literal('minimumPaidDuration'), minutes: z.number().int().min(0) }),
    z.object({ type: z.literal('rateOverride'), hourlyRateMinor: z.number().int().positive() }),
  ]),
  isEnabled: z.boolean().default(true),
  canStack: z.boolean(),
  premiumFamily: z.enum(['ordinary', 'overtime', 'special_interval']).optional(),
  effectiveFrom: z.iso.date().optional(),
  effectiveTo: z.iso.date().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).superRefine((rule, context) => {
  if (rule.effectiveFrom && rule.effectiveTo && rule.effectiveTo < rule.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Effective end must not precede start.' });
  }
  if (rule.premiumFamily && rule.effect.type !== 'multiplier') {
    context.addIssue({ code: 'custom', path: ['premiumFamily'], message: 'Only multiplier rules can declare a premium family.' });
  }
  if (rule.premiumFamily === 'overtime' && !rule.conditions.some((condition) => condition.type === 'workedMinutes')) {
    context.addIssue({ code: 'custom', path: ['premiumFamily'], message: 'Overtime-family rules require a worked-minute condition.' });
  }
  if (rule.premiumFamily === 'special_interval' && !rule.conditions.some((condition) => (
    condition.type === 'specialInterval' || condition.type === 'holiday' || condition.type === 'weekend'
  ))) {
    context.addIssue({ code: 'custom', path: ['premiumFamily'], message: 'Special-interval-family rules require a special interval condition.' });
  }
});

export type PayRule = z.infer<typeof payRuleSchema>;
