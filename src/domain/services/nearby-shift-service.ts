import { differenceInMinutes } from 'date-fns';
import type { Shift } from '@/domain/entities';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

export interface NearbyShiftCandidate { shiftId: string; absoluteStartDifferenceMinutes: number; isSameLocalDate: boolean; isSameWorkplace?: boolean; reasons: string[] }
export interface NearbyShiftMatchResult { candidates: NearbyShiftCandidate[]; recommendedShiftId?: string }
interface MatchOptions { maximumDifferenceMinutes?: number; timezone?: string; workplaceId?: string; clearLeadMinutes?: number }

export function matchNearbyScheduledShifts(shifts: readonly Shift[], now: Date, options: MatchOptions = {}): NearbyShiftMatchResult {
  const maximumDifferenceMinutes = options.maximumDifferenceMinutes ?? 180;
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const candidates = shifts.filter((shift) => shift.status === 'scheduled' && shift.scheduledStart && shift.scheduledEnd).map((shift): NearbyShiftCandidate | null => {
    const difference = Math.abs(differenceInMinutes(now, shift.scheduledStart!));
    if (difference > maximumDifferenceMinutes) return null;
    const sameDate = formatLocalDateKey(now, timezone) === formatLocalDateKey(shift.scheduledStart!, timezone);
    const sameWorkplace = options.workplaceId ? options.workplaceId === shift.workplaceId : undefined;
    const reasons = [`${difference} minutes from scheduled start`];
    if (sameDate) reasons.push('same local date');
    if (sameWorkplace) reasons.push('same workplace');
    if (Date.parse(shift.scheduledEnd!) < now.getTime()) reasons.push('scheduled end has passed');
    return { shiftId: shift.id, absoluteStartDifferenceMinutes: difference, isSameLocalDate: sameDate, isSameWorkplace: sameWorkplace, reasons };
  }).filter((candidate): candidate is NearbyShiftCandidate => Boolean(candidate)).sort((left, right) => left.absoluteStartDifferenceMinutes - right.absoluteStartDifferenceMinutes);
  const lead = (candidates[1]?.absoluteStartDifferenceMinutes ?? Number.POSITIVE_INFINITY) - (candidates[0]?.absoluteStartDifferenceMinutes ?? 0);
  return { candidates, recommendedShiftId: candidates.length === 1 || lead >= (options.clearLeadMinutes ?? 30) ? candidates[0]?.shiftId : undefined };
}
