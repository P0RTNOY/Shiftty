import { differenceInMinutes } from 'date-fns';

import type { BreakSession, Shift } from '@/domain/entities';
import { summarizeBreakSessions, validateBreakSessions } from '@/domain/services/break-session-service';

export interface LiveShiftMetrics { elapsedMinutes: number; paidBreakMinutes: number; unpaidBreakMinutes: number; activeBreakMinutes: number; netWorkedMinutes: number; isOnBreak: boolean }
export interface EndShiftReview { scheduledMinutes?: number; actualMinutes: number; paidBreakMinutes: number; unpaidBreakMinutes: number; netActualMinutes: number }

export function calculateLiveShiftMetrics(shift: Shift, breaks: readonly BreakSession[], now: Date): LiveShiftMetrics {
  if (shift.status !== 'active' || !shift.actualStart) throw new Error('Live metrics require an active shift.');
  validateBreakSessions(shift, breaks, now);
  const elapsedMinutes = Math.max(0, differenceInMinutes(now, shift.actualStart));
  const summary = summarizeBreakSessions(breaks, now);
  return { elapsedMinutes, paidBreakMinutes: summary.paidMinutes, unpaidBreakMinutes: summary.unpaidMinutes, activeBreakMinutes: summary.activeMinutes, netWorkedMinutes: Math.max(0, elapsedMinutes - summary.unpaidMinutes), isOnBreak: Boolean(summary.activeBreak) };
}

export function isActiveShiftStale(shift: Shift, now: Date, thresholdMinutes = 16 * 60): boolean {
  return shift.status === 'active' && Boolean(shift.actualStart) && differenceInMinutes(now, shift.actualStart!) >= thresholdMinutes;
}

export function resolveExpectedEnd(shift: Shift): string | undefined { return shift.expectedEnd ?? shift.scheduledEnd; }

export function buildEndShiftReview(shift: Shift, breaks: readonly BreakSession[], actualEnd: string): EndShiftReview {
  if (!shift.actualStart) throw new Error('Actual start is required.');
  const now = new Date(actualEnd);
  validateBreakSessions({ ...shift, actualEnd }, breaks, now);
  const summary = summarizeBreakSessions(breaks, now);
  const actualMinutes = differenceInMinutes(actualEnd, shift.actualStart);
  const scheduledMinutes = shift.scheduledStart && shift.scheduledEnd ? differenceInMinutes(shift.scheduledEnd, shift.scheduledStart) : undefined;
  return { scheduledMinutes, actualMinutes, paidBreakMinutes: summary.paidMinutes, unpaidBreakMinutes: summary.unpaidMinutes, netActualMinutes: Math.max(0, actualMinutes - summary.unpaidMinutes) };
}
