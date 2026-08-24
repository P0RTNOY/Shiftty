import { differenceInMinutes } from 'date-fns';

import { shiftSchema, type Shift, type Workplace } from '@/domain/entities';
import { resolveLocalShiftRange } from '@/shared/utils/zoned-time';
import { assertShiftDurationWithinLimit } from './shift-duration-policy';

interface ShiftFactoryContext {
  id: string;
  now: string;
  timezone: string;
}

interface BaseShiftInput {
  workplaceId: string;
  roleId?: string;
  shiftTemplateId?: string;
  shiftTypeNameSnapshot?: string;
  shiftTypePayMultiplierBasisPoints?: number;
  title?: string;
  notes?: string;
  hourlyRateSnapshotMinor: number;
}

export interface ActiveShiftInput {
  workplace: Workplace;
  roleId?: string;
  shiftTemplateId?: string;
  shiftTypeNameSnapshot?: string;
  shiftTypePayMultiplierBasisPoints?: number;
  expectedBreakMinutes?: number;
}

export interface ScheduledShiftInput extends BaseShiftInput {
  date: string;
  startTime: string;
  endTime: string;
  expectedBreakMinutes: number;
  maximumExistingDurationMinutes?: number;
}

export interface CompletedShiftInput extends BaseShiftInput {
  date: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime: string;
  actualEndTime: string;
  payableStartTime?: string;
  payableEndTime?: string;
  actualBreakMinutes: number;
  payableBreakMinutes: number;
  maximumExistingScheduledDurationMinutes?: number;
  maximumExistingActualDurationMinutes?: number;
  maximumExistingPayableDurationMinutes?: number;
}

export function createScheduledShift(input: ScheduledShiftInput, context: ShiftFactoryContext): Shift {
  const scheduled = resolveLocalShiftRange(input.date, input.startTime, input.endTime, context.timezone);
  assertShiftDurationWithinLimit(scheduled.start, scheduled.end, input.maximumExistingDurationMinutes);
  return shiftSchema.parse({
    ...baseFields(input, context),
    scheduledStart: scheduled.start,
    scheduledEnd: scheduled.end,
    expectedBreakMinutes: input.expectedBreakMinutes,
    status: 'scheduled',
  });
}

export function createActiveShift(input: ActiveShiftInput, context: ShiftFactoryContext): Shift {
  return shiftSchema.parse({
    id: context.id,
    workplaceId: input.workplace.id,
    roleId: input.roleId,
    shiftTemplateId: input.shiftTemplateId,
    shiftTypeNameSnapshot: input.shiftTypeNameSnapshot,
    shiftTypePayMultiplierBasisPoints: input.shiftTypePayMultiplierBasisPoints,
    actualStart: context.now,
    expectedBreakMinutes: input.expectedBreakMinutes ?? input.workplace.defaultBreakMinutes,
    status: 'active',
    activeOrigin: 'unscheduled',
    hourlyRateSnapshotMinor: input.workplace.defaultHourlyRateMinor,
    timezone: context.timezone,
    createdAt: context.now,
    updatedAt: context.now,
  });
}

export function createCompletedShift(input: CompletedShiftInput, context: ShiftFactoryContext): Shift {
  if (Boolean(input.scheduledStartTime) !== Boolean(input.scheduledEndTime)) {
    throw new Error('Scheduled start and end must both be provided.');
  }

  const scheduled = input.scheduledStartTime && input.scheduledEndTime
    ? resolveLocalShiftRange(input.date, input.scheduledStartTime, input.scheduledEndTime, context.timezone)
    : undefined;
  const actual = resolveLocalShiftRange(input.date, input.actualStartTime, input.actualEndTime, context.timezone);
  const payable = resolveLocalShiftRange(
    input.date,
    input.payableStartTime ?? input.actualStartTime,
    input.payableEndTime ?? input.actualEndTime,
    context.timezone,
  );

  if (scheduled) assertShiftDurationWithinLimit(scheduled.start, scheduled.end, input.maximumExistingScheduledDurationMinutes);
  assertShiftDurationWithinLimit(actual.start, actual.end, input.maximumExistingActualDurationMinutes);
  assertShiftDurationWithinLimit(payable.start, payable.end, input.maximumExistingPayableDurationMinutes);

  if (input.actualBreakMinutes > differenceInMinutes(actual.end, actual.start)) {
    throw new Error('Actual break cannot exceed actual shift duration.');
  }
  if (input.payableBreakMinutes > differenceInMinutes(payable.end, payable.start)) {
    throw new Error('Payable break cannot exceed payable shift duration.');
  }

  return shiftSchema.parse({
    ...baseFields(input, context),
    scheduledStart: scheduled?.start,
    scheduledEnd: scheduled?.end,
    actualStart: actual.start,
    actualEnd: actual.end,
    payableStart: payable.start,
    payableEnd: payable.end,
    expectedBreakMinutes: 0,
    actualBreakMinutes: input.actualBreakMinutes,
    payableBreakMinutes: input.payableBreakMinutes,
    payableSource: 'manual',
    completedAt: context.now,
    status: 'completed',
  });
}

export function isCompletedShiftFutureDated(shift: Shift, now = new Date()): boolean {
  return shift.status === 'completed' && Boolean(shift.actualStart) && new Date(shift.actualStart!).getTime() > now.getTime();
}

function baseFields(input: BaseShiftInput, context: ShiftFactoryContext) {
  return {
    id: context.id,
    workplaceId: input.workplaceId,
    roleId: input.roleId,
    shiftTemplateId: input.shiftTemplateId,
    shiftTypeNameSnapshot: input.shiftTypeNameSnapshot,
    shiftTypePayMultiplierBasisPoints: input.shiftTypePayMultiplierBasisPoints,
    title: input.title,
    notes: input.notes,
    hourlyRateSnapshotMinor: input.hourlyRateSnapshotMinor,
    timezone: context.timezone,
    createdAt: context.now,
    updatedAt: context.now,
  };
}
