import type { Shift, Workplace } from '@/domain/entities';
import { matchNearbyScheduledShifts } from './nearby-shift-service';

interface ClockInDecisionInput {
  shifts: readonly Shift[];
  workplaces: readonly Workplace[];
  now: Date;
}

export type ClockInDecision =
  | { kind: 'scheduled'; shiftId: string }
  | { kind: 'workplace'; workplaceId: string }
  | { kind: 'choose-workplace'; workplaceIds: string[] }
  | { kind: 'choose-shift'; shiftIds: string[] }
  | { kind: 'unavailable' };

export function resolveClockInDecision({ shifts, workplaces, now }: ClockInDecisionInput): ClockInDecision {
  const nearby = matchNearbyScheduledShifts(shifts, now, { maximumDifferenceMinutes: 180 });
  if (nearby.recommendedShiftId) {
    return { kind: 'scheduled', shiftId: nearby.recommendedShiftId };
  }
  if (nearby.candidates.length > 0) {
    return { kind: 'choose-shift', shiftIds: nearby.candidates.map((item) => item.shiftId) };
  }

  const activeWorkplaces = workplaces.filter((item) => !item.isArchived);
  if (activeWorkplaces.length === 1) {
    return { kind: 'workplace', workplaceId: activeWorkplaces[0]!.id };
  }
  if (activeWorkplaces.length > 1) {
    return { kind: 'choose-workplace', workplaceIds: activeWorkplaces.map((item) => item.id) };
  }
  return { kind: 'unavailable' };
}
