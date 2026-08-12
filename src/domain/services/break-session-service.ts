import { differenceInMinutes } from 'date-fns';

import type { BreakSession, Shift } from '@/domain/entities';
import { formatLocalDateKey, resolveLocalShiftRange, type ResolvedShiftRange } from '@/shared/utils/zoned-time';

export interface BreakSummary {
  paidMinutes: number;
  unpaidMinutes: number;
  activeMinutes: number;
  activeBreak?: BreakSession;
}

export function summarizeBreakSessions(breaks: readonly BreakSession[], now: Date): BreakSummary {
  let paidMinutes = 0;
  let unpaidMinutes = 0;
  let activeMinutes = 0;
  let activeBreak: BreakSession | undefined;
  for (const session of breaks) {
    const minutes = Math.max(0, differenceInMinutes(session.end ?? now.toISOString(), session.start));
    if (!session.end) { activeMinutes = minutes; activeBreak = session; }
    if (session.isPaid) paidMinutes += minutes;
    else unpaidMinutes += minutes;
  }
  return { paidMinutes, unpaidMinutes, activeMinutes, activeBreak };
}

export function validateBreakSessions(shift: Shift, breaks: readonly BreakSession[], now: Date): void {
  if (!shift.actualStart) throw new Error('Breaks require an actual shift start.');
  const openCount = breaks.filter((session) => !session.end).length;
  if (openCount > 1) throw new Error('Only one open break is allowed.');
  if (openCount && shift.status !== 'active') throw new Error('A completed or cancelled shift cannot have an open break.');
  const shiftStart = Date.parse(shift.actualStart);
  const shiftEnd = Date.parse(shift.actualEnd ?? now.toISOString());
  const sorted = [...breaks].sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
  let priorEnd = Number.NEGATIVE_INFINITY;
  for (const session of sorted) {
    if (session.shiftId !== shift.id) throw new Error('A break must belong to its active shift.');
    const start = Date.parse(session.start);
    const end = Date.parse(session.end ?? now.toISOString());
    if (start < shiftStart || end > shiftEnd) throw new Error('A break must be inside the actual shift range.');
    if (end <= start) throw new Error('Break end must be after break start.');
    if (start < priorEnd) throw new Error('Break sessions cannot overlap.');
    priorEnd = end;
  }
}

export function resolveManualBreakRange(shift: Shift, startTime: string, endTime: string, now: Date): ResolvedShiftRange {
  if (!shift.actualStart) throw new Error('Breaks require an actual shift start.');
  const shiftStart = Date.parse(shift.actualStart);
  const shiftEnd = Date.parse(shift.actualEnd ?? now.toISOString());
  const dates = [...new Set([
    formatLocalDateKey(shift.actualStart, shift.timezone),
    formatLocalDateKey(shift.actualEnd ?? now, shift.timezone),
  ])];

  for (const date of dates) {
    const range = resolveLocalShiftRange(date, startTime, endTime, shift.timezone);
    if (Date.parse(range.start) >= shiftStart && Date.parse(range.end) <= shiftEnd) return range;
  }
  throw new Error('A break must be inside the actual shift range.');
}
