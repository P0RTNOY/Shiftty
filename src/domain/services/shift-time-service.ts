import { differenceInMinutes } from 'date-fns';

import type { BreakSession, Shift } from '@/domain/entities';

export type ShiftTimeKind = 'scheduled' | 'actual' | 'payable';

export interface ShiftDurationResult {
  grossMinutes: number;
  unpaidBreakMinutes: number;
  paidMinutes: number;
}

const MAX_REASONABLE_SHIFT_MINUTES = 24 * 60;

export function calculateShiftDuration(
  shift: Shift,
  kind: ShiftTimeKind,
  breaks: readonly BreakSession[] = [],
): ShiftDurationResult | null {
  const range = getShiftRange(shift, kind);

  if (!range.end) {
    return null;
  }

  const grossMinutes = differenceInMinutes(range.end, range.start);
  if (grossMinutes <= 0) {
    throw new Error('Shift end must be after shift start.');
  }
  if (grossMinutes > MAX_REASONABLE_SHIFT_MINUTES) {
    throw new Error('Shift duration exceeds the supported 24-hour safety limit.');
  }

  const unpaidBreakMinutes = breaks.length
    ? calculateSessionBreakMinutes(breaks, { start: range.start, end: range.end })
    : getStoredBreakMinutes(shift, kind);

  return {
    grossMinutes,
    unpaidBreakMinutes,
    paidMinutes: Math.max(0, grossMinutes - unpaidBreakMinutes),
  };
}

function calculateSessionBreakMinutes(
  breaks: readonly BreakSession[],
  range: { start: string; end: string },
): number {
  const sortedBreaks = [...breaks].sort(
    (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
  );
  let previousEnd = Number.NEGATIVE_INFINITY;
  let unpaidMinutes = 0;

  for (const session of sortedBreaks) {
    if (!session.end) {
      throw new Error('A completed shift cannot contain an open break.');
    }

    const start = new Date(session.start).getTime();
    const end = new Date(session.end).getTime();
    if (start < previousEnd) {
      throw new Error('Break sessions cannot overlap.');
    }
    if (start < new Date(range.start).getTime() || end > new Date(range.end).getTime()) {
      throw new Error('Break must be contained within the selected shift range.');
    }

    const breakMinutes = differenceInMinutes(session.end, session.start);
    if (!session.isPaid) {
      unpaidMinutes += breakMinutes;
    }
    previousEnd = end;
  }

  return unpaidMinutes;
}

function getStoredBreakMinutes(shift: Shift, kind: ShiftTimeKind): number {
  switch (kind) {
    case 'scheduled':
      return shift.expectedBreakMinutes;
    case 'actual':
      return shift.actualBreakMinutes ?? 0;
    case 'payable':
      return shift.payableBreakMinutes ?? 0;
  }
}

function getShiftRange(shift: Shift, kind: ShiftTimeKind): { start: string; end?: string } {
  switch (kind) {
    case 'scheduled':
      if (!shift.scheduledStart) {
        throw new Error('Scheduled start time is missing.');
      }
      return { start: shift.scheduledStart, end: shift.scheduledEnd };
    case 'actual':
      if (!shift.actualStart) {
        throw new Error('Actual start time is missing.');
      }
      return { start: shift.actualStart, end: shift.actualEnd };
    case 'payable':
      if (!shift.payableStart) {
        throw new Error('Payable start time is missing.');
      }
      return { start: shift.payableStart, end: shift.payableEnd };
  }
}
