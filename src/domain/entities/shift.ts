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

export const shiftSchema = z
  .object({
    id: z.string().min(1),
    workplaceId: z.string().min(1),
    roleId: z.string().min(1).optional(),
    salaryProfileId: z.string().min(1).optional(),
    title: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(4_000).optional(),
    scheduledStart: isoTimestampSchema,
    scheduledEnd: isoTimestampSchema,
    actualStart: isoTimestampSchema.optional(),
    actualEnd: isoTimestampSchema.optional(),
    payableStart: isoTimestampSchema.optional(),
    payableEnd: isoTimestampSchema.optional(),
    expectedBreakMinutes: nonNegativeMinutesSchema,
    actualBreakMinutes: nonNegativeMinutesSchema.optional(),
    payableBreakMinutes: nonNegativeMinutesSchema.optional(),
    status: shiftStatusSchema,
    hourlyRateSnapshotMinor: minorUnitsSchema,
    expectedGrossPayMinor: minorUnitsSchema.optional(),
    actualGrossPayMinor: minorUnitsSchema.optional(),
    payableGrossPayMinor: minorUnitsSchema.optional(),
    recurrenceGroupId: z.string().min(1).optional(),
    timezone: z.string().min(1).default('Asia/Jerusalem'),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .superRefine((shift, context) => {
    validateRange('scheduledStart', 'scheduledEnd', shift.scheduledStart, shift.scheduledEnd, context);
    validateOptionalRange('actualStart', 'actualEnd', shift.actualStart, shift.actualEnd, context);
    validateOptionalRange('payableStart', 'payableEnd', shift.payableStart, shift.payableEnd, context);

    if (shift.status === 'active' && !shift.actualStart) {
      context.addIssue({
        code: 'custom',
        path: ['actualStart'],
        message: 'An active shift requires an actual start time.',
      });
    }

    if (shift.status === 'completed' && (!shift.actualStart || !shift.actualEnd)) {
      context.addIssue({
        code: 'custom',
        path: ['actualEnd'],
        message: 'A completed shift requires actual start and end times.',
      });
    }
  });

export type Shift = z.infer<typeof shiftSchema>;

function validateOptionalRange(
  startKey: 'actualStart' | 'payableStart',
  endKey: 'actualEnd' | 'payableEnd',
  start: string | undefined,
  end: string | undefined,
  context: z.RefinementCtx,
) {
  if (end && !start) {
    context.addIssue({
      code: 'custom',
      path: [startKey],
      message: `${startKey} is required when ${endKey} is present.`,
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
