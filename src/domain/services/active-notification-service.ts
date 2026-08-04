import { addMinutes } from 'date-fns';
import type { BreakSession, Shift } from '@/domain/entities';
import { resolveExpectedEnd } from '@/domain/services/live-shift-service';

export type ActiveNotificationKind = 'expected-end-soon' | 'expected-end' | 'still-active' | 'long-break';
export interface ActiveNotificationPlanItem { kind: ActiveNotificationKind; at: string; shiftId: string; breakId?: string }

export function buildActiveNotificationPlan(shift: Shift, activeBreak: BreakSession | undefined, now: Date): ActiveNotificationPlanItem[] {
  const items: ActiveNotificationPlanItem[] = []; const expectedEnd = resolveExpectedEnd(shift);
  if (expectedEnd) {
    const points = [
      { kind: 'expected-end-soon' as const, at: addMinutes(expectedEnd, -15) },
      { kind: 'expected-end' as const, at: new Date(expectedEnd) },
      { kind: 'still-active' as const, at: addMinutes(expectedEnd, 60) },
    ];
    for (const point of points) if (point.at > now) items.push({ kind: point.kind, at: point.at.toISOString(), shiftId: shift.id });
  }
  if (activeBreak) {
    const at = addMinutes(activeBreak.start, 30);
    if (at > now) items.push({ kind: 'long-break', at: at.toISOString(), shiftId: shift.id, breakId: activeBreak.id });
  }
  return items;
}
