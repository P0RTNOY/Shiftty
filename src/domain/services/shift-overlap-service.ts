import type { Shift } from '@/domain/entities';

export interface ShiftRange {
  start: string;
  end: string;
}

export function getEffectiveShiftRange(shift: Shift): ShiftRange {
  if (shift.scheduledStart && shift.scheduledEnd) {
    return { start: shift.scheduledStart, end: shift.scheduledEnd };
  }
  if (shift.actualStart && shift.actualEnd) {
    return { start: shift.actualStart, end: shift.actualEnd };
  }
  if (shift.payableStart && shift.payableEnd) {
    return { start: shift.payableStart, end: shift.payableEnd };
  }
  throw new Error('Shift does not have a complete time range.');
}

export function shiftsOverlap(left: Shift, right: Shift): boolean {
  if (left.status === 'cancelled' || right.status === 'cancelled') {
    return false;
  }
  const leftRange = getEffectiveShiftRange(left);
  const rightRange = getEffectiveShiftRange(right);
  return (
    new Date(leftRange.start).getTime() < new Date(rightRange.end).getTime() &&
    new Date(rightRange.start).getTime() < new Date(leftRange.end).getTime()
  );
}

export function findShiftOverlaps(candidate: Shift, existing: readonly Shift[]): Shift[] {
  return existing.filter((shift) => shift.id !== candidate.id && shiftsOverlap(candidate, shift));
}
