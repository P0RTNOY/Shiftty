import { z } from 'zod';

export const moneyRoundingModeSchema = z.enum(['half_up', 'floor', 'ceiling']);
export type MoneyRoundingMode = z.infer<typeof moneyRoundingModeSchema>;

export const salaryProfileSchema = z
  .object({
    id: z.string().min(1),
    workplaceId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(120),
    currency: z.string().length(3).default('ILS'),
    timezone: z.string().min(1).default('Asia/Jerusalem'),
    baseHourlyRateMinor: z.number().int().min(0),
    defaultTravelReimbursementMinor: z.number().int().min(0).default(0),
    defaultShiftBonusMinor: z.number().int().min(0).default(0),
    calculationRoundingMode: moneyRoundingModeSchema.default('half_up'),
    breakPolicy: z.enum(['paid', 'unpaid', 'perBreak']).default('perBreak'),
    workweekStartWeekday: z.number().int().min(0).max(6).default(0),
    weeklyOvertimeEnabled: z.boolean().default(false),
    weeklyRegularMinutes: z.number().int().positive().optional(),
    weeklyOvertimeMultiplierBasisPoints: z.number().int().min(10_000).optional(),
    weeklyOvertimeBasis: z.enum(['net', 'gross']).default('net'),
    effectiveFrom: z.iso.date().optional(),
    effectiveTo: z.iso.date().optional(),
    isActive: z.boolean().default(true),
    isArchived: z.boolean().default(false),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((profile, context) => {
    if (profile.effectiveFrom && profile.effectiveTo && profile.effectiveTo < profile.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Effective end must not precede start.' });
    }
    if (profile.weeklyOvertimeEnabled && profile.weeklyRegularMinutes === undefined) {
      context.addIssue({ code: 'custom', path: ['weeklyRegularMinutes'], message: 'Enabled weekly overtime requires a regular-time threshold.' });
    }
    if (profile.weeklyOvertimeEnabled && profile.weeklyOvertimeMultiplierBasisPoints === undefined) {
      context.addIssue({ code: 'custom', path: ['weeklyOvertimeMultiplierBasisPoints'], message: 'Enabled weekly overtime requires a multiplier.' });
    }
  });

export type SalaryProfile = z.infer<typeof salaryProfileSchema>;
