import { z } from 'zod';

const isoTimestampSchema = z.iso.datetime({ offset: true });
const nonNegativeMinutesSchema = z.number().int().min(0);
const minorUnitsSchema = z.number().int().min(0);

export const shiftStatusSchema = z.enum([
  'scheduled',
  'active',
  'completed',
  'missed',
  'cancelled',
]);

export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

export const activeShiftOriginSchema = z.enum(['scheduled', 'unscheduled']);
export const payableSourceSchema = z.enum(['actual', 'scheduled', 'rounded', 'manual']);
export const salaryCalculationStatusSchema = z.enum(['not_calculated', 'estimated', 'finalized', 'incomplete', 'stale']);
export type ActiveShiftOrigin = z.infer<typeof activeShiftOriginSchema>;
export type PayableSource = z.infer<typeof payableSourceSchema>;
export type SalaryCalculationStatus = z.infer<typeof salaryCalculationStatusSchema>;

export const shiftSchema = z
  .object({
    id: z.string().min(1),
    workplaceId: z.string().min(1),
    roleId: z.string().min(1).optional(),
    salaryProfileId: z.string().min(1).optional(),
    title: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(4_000).optional(),
    scheduledStart: isoTimestampSchema.optional(),
    scheduledEnd: isoTimestampSchema.optional(),
    actualStart: isoTimestampSchema.optional(),
    actualEnd: isoTimestampSchema.optional(),
    payableStart: isoTimestampSchema.optional(),
    payableEnd: isoTimestampSchema.optional(),
    expectedBreakMinutes: nonNegativeMinutesSchema,
    actualBreakMinutes: nonNegativeMinutesSchema.optional(),
    payableBreakMinutes: nonNegativeMinutesSchema.optional(),
    status: shiftStatusSchema,
    hourlyRateSnapshotMinor: minorUnitsSchema,
    hourlyRateOverrideMinor: minorUnitsSchema.optional(),
    fixedBonusOverrideMinor: minorUnitsSchema.optional(),
    travelReimbursementOverrideMinor: minorUnitsSchema.optional(),
    salaryCalculationStatus: salaryCalculationStatusSchema.default('not_calculated'),
    expectedGrossPayMinor: minorUnitsSchema.optional(),
    actualGrossPayMinor: minorUnitsSchema.optional(),
    payableGrossPayMinor: minorUnitsSchema.optional(),
    shiftTemplateId: z.string().min(1).optional(),
    recurrenceGroupId: z.string().min(1).optional(),
    recurrenceOriginalStart: isoTimestampSchema.optional(),
    recurrenceExceptionType: z.enum(['modified']).optional(),
    cancelledAt: isoTimestampSchema.optional(),
    expectedEnd: isoTimestampSchema.optional(),
    activeOrigin: activeShiftOriginSchema.optional(),
    payableSource: payableSourceSchema.optional(),
    completedAt: isoTimestampSchema.optional(),
    timezone: z.string().min(1).default('Asia/Jerusalem'),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .superRefine((shift, context) => {
    validateOptionalRange('scheduledStart', 'scheduledEnd', shift.scheduledStart, shift.scheduledEnd, context);
    validateOptionalRange(
      'actualStart',
      'actualEnd',
      shift.actualStart,
      shift.actualEnd,
      context,
      shift.status === 'active',
    );
    validateOptionalRange('payableStart', 'payableEnd', shift.payableStart, shift.payableEnd, context);

    if (shift.status === 'active' && !shift.actualStart) {
      context.addIssue({
        code: 'custom',
        path: ['actualStart'],
        message: 'An active shift requires an actual start time.',
      });
    }

    if (shift.status === 'active' && !shift.activeOrigin) {
      context.addIssue({
        code: 'custom',
        path: ['activeOrigin'],
        message: 'An active shift requires its tracking origin.',
      });
    }

    if (shift.status === 'completed' && (!shift.actualStart || !shift.actualEnd)) {
      context.addIssue({
        code: 'custom',
        path: ['actualEnd'],
        message: 'A completed shift requires actual start and end times.',
      });
    }

    if ((shift.status === 'scheduled' || shift.status === 'missed') && (!shift.scheduledStart || !shift.scheduledEnd)) {
      context.addIssue({
        code: 'custom',
        path: ['scheduledStart'],
        message: 'A complete scheduled range is required for this shift status.',
      });
    }


    if (shift.status === 'completed' && !shift.completedAt) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A completed shift requires a completion timestamp.',
      });
    }

    if (shift.status === 'completed' && (!shift.payableStart || !shift.payableEnd || !shift.payableSource)) {
      context.addIssue({
        code: 'custom',
        path: ['payableStart'],
        message: 'A completed shift requires a payable range and source.',
      });
    }
  });

export type Shift = z.infer<typeof shiftSchema>;

function validateOptionalRange(
  startKey: 'scheduledStart' | 'actualStart' | 'payableStart',
  endKey: 'scheduledEnd' | 'actualEnd' | 'payableEnd',
  start: string | undefined,
  end: string | undefined,
  context: z.RefinementCtx,
  allowOpenEnd = false,
) {
  if (end && !start) {
    context.addIssue({
      code: 'custom',
      path: [startKey],
      message: `${startKey} is required when ${endKey} is present.`,
    });
  }

  if (start && !end && !allowOpenEnd) {
    context.addIssue({
      code: 'custom',
      path: [endKey],
      message: `${endKey} is required when ${startKey} is present.`,
    });
  }

  if (start && end) {
    validateRange(startKey, endKey, start, end, context);
  }
}

function validateRange(
  _startKey: 'scheduledStart' | 'actualStart' | 'payableStart',
  endKey: 'scheduledEnd' | 'actualEnd' | 'payableEnd',
  start: string,
  end: string,
  context: z.RefinementCtx,
) {
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    context.addIssue({
      code: 'custom',
      path: [endKey],
      message: 'End time must be after start time.',
    });
  }
}
