import { z } from 'zod';

export const payRuleConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weekday'), weekdays: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ type: z.literal('timeWindow'), startTime: z.string(), endTime: z.string() }),
  z.object({ type: z.literal('date'), date: z.iso.date() }),
  z.object({ type: z.literal('workplace'), workplaceId: z.string().min(1) }),
  z.object({ type: z.literal('role'), roleId: z.string().min(1) }),
  z.object({ type: z.literal('minimumDuration'), minutes: z.number().int().positive() }),
]);

export type PayRuleCondition = z.infer<typeof payRuleConditionSchema>;

export const payRuleSchema = z.object({
  id: z.string().min(1),
  salaryProfileId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  priority: z.number().int(),
  conditions: z.array(payRuleConditionSchema),
  effect: z.discriminatedUnion('type', [
    z.object({ type: z.literal('multiplier'), basisPoints: z.number().int().min(0) }),
    z.object({ type: z.literal('fixedBonus'), amountMinor: z.number().int().min(0) }),
    z.object({ type: z.literal('reimbursement'), amountMinor: z.number().int().min(0) }),
    z.object({ type: z.literal('minimumPaidDuration'), minutes: z.number().int().min(0) }),
  ]),
  canStack: z.boolean(),
  effectiveFrom: z.iso.date().optional(),
  effectiveTo: z.iso.date().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type PayRule = z.infer<typeof payRuleSchema>;
