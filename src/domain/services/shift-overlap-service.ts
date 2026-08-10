import type { Shift } from '@/domain/entities';

export interface ShiftRange {
  start: string;
  end: string;
}

export function getEffectiveShiftRange(shift: Shift): ShiftRange {
  if (shift.status === 'completed') {
    return firstCompleteRange(
      [shift.actualStart, shift.actualEnd],
      [shift.payableStart, shift.payableEnd],
      [shift.scheduledStart, shift.scheduledEnd],
    );
  }

  if (shift.status === 'active' && shift.actualStart) {
    return {
      start: shift.actualStart,
      end: shift.actualEnd ?? shift.expectedEnd ?? shift.scheduledEnd ?? shift.actualStart,
    };
  }

  return firstCompleteRange(
    [shift.scheduledStart, shift.scheduledEnd],
    [shift.actualStart, shift.actualEnd],
    [shift.payableStart, shift.payableEnd],
  );
}

function firstCompleteRange(...candidates: readonly (readonly [string | undefined, string | undefined])[]): ShiftRange {
  const range = candidates.find(([start, end]) => Boolean(start && end));
  if (!range?.[0] || !range[1]) throw new Error('Shift does not have a complete time range.');
  return { start: range[0], end: range[1] };
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
