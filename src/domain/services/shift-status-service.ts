import type { Shift, ShiftStatus } from '@/domain/entities';

const ALLOWED_TRANSITIONS: Record<ShiftStatus, readonly ShiftStatus[]> = {
  scheduled: ['active', 'completed', 'missed', 'cancelled'],
  active: ['completed', 'scheduled', 'cancelled'],
  completed: [],
  missed: ['scheduled'],
  cancelled: ['scheduled'],
};

export function getAllowedShiftTransitions(status: ShiftStatus): readonly ShiftStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export function assertShiftStatusTransition(from: ShiftStatus, to: ShiftStatus): void {
  if (from === to) {
    return;
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Shift status transition from ${from} to ${to} is not allowed.`);
  }
}

export function canMarkShiftMissed(shift: Shift, now = new Date()): boolean {
  return (
    shift.status === 'scheduled' &&
    Boolean(shift.scheduledEnd) &&
    new Date(shift.scheduledEnd!).getTime() < now.getTime()
  );
}
