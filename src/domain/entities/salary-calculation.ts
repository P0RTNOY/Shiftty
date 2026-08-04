import { z } from 'zod';

export const holidayIntervalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
});
export type HolidayInterval = z.infer<typeof holidayIntervalSchema>;

export const payCalculationIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['warning', 'error']),
  messageKey: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PayCalculationIssue = z.infer<typeof payCalculationIssueSchema>;

export const paySegmentSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  localDate: z.iso.date(),
  minutes: z.number().int().positive(),
  baseHourlyRateMinor: z.number().int().positive(),
  multiplierBasisPoints: z.number().int().min(0),
  basePayMinor: z.number().int().min(0),
  premiumPayMinor: z.number().int().min(0),
  totalPayMinor: z.number().int().min(0),
  appliedRuleIds: z.array(z.string()),
  labels: z.array(z.string()),
});
export type PaySegment = z.infer<typeof paySegmentSchema>;

export const payCalculationResultSchema = z.object({
  context: z.enum(['scheduled', 'completed', 'active_provisional']),
  calculationTimezone: z.string().min(1),
  sourceRange: z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) }),
  workIntervals: z.array(z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }), minutes: z.number().int().positive() })),
  grossMinutes: z.number().int().min(0),
  paidBreakMinutes: z.number().int().min(0),
  unpaidBreakMinutes: z.number().int().min(0),
  payableMinutes: z.number().int().min(0),
  regularMinutes: z.number().int().min(0),
  specialRateMinutes: z.number().int().min(0),
  segments: z.array(paySegmentSchema),
  basePayMinor: z.number().int().min(0),
  premiumPayMinor: z.number().int().min(0),
  minimumDurationAdjustmentMinutes: z.number().int().min(0),
  minimumDurationAdjustmentMinor: z.number().int().min(0),
  fixedBonusesMinor: z.number().int().min(0),
  reimbursementsMinor: z.number().int().min(0),
  totalGrossPayMinor: z.number().int().min(0).optional(),
  resolvedBaseHourlyRateMinor: z.number().int().positive().optional(),
  appliedRuleIds: z.array(z.string()),
  issues: z.array(payCalculationIssueSchema),
  explanations: z.array(z.string()),
  calculatedAt: z.iso.datetime({ offset: true }),
  engineVersion: z.string().min(1),
});
export type PayCalculationResult = z.infer<typeof payCalculationResultSchema>;

export const salaryCalculationSnapshotSchema = z.object({
  id: z.string().min(1),
  shiftId: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['estimated', 'finalized', 'incomplete']),
  salaryProfileId: z.string().min(1).optional(),
  result: payCalculationResultSchema,
  isCurrent: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type SalaryCalculationSnapshot = z.infer<typeof salaryCalculationSnapshotSchema>;
