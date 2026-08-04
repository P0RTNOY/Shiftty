import {
  assertShiftStatusTransition,
  canMarkShiftMissed,
  getAllowedShiftTransitions,
} from '@/domain/services/shift-status-service';
import { createShift } from '@/test/fixtures';

describe('shift status transitions', () => {
  it('allows Phase 2 scheduled-shift transitions', () => {
    expect(getAllowedShiftTransitions('scheduled')).toEqual(['active', 'completed', 'missed', 'cancelled']);
    expect(() => assertShiftStatusTransition('scheduled', 'cancelled')).not.toThrow();
    expect(() => assertShiftStatusTransition('scheduled', 'active')).not.toThrow();
  });

  it('allows restoring a cancelled shift but forbids completed mutations', () => {
    expect(() => assertShiftStatusTransition('cancelled', 'scheduled')).not.toThrow();
    expect(() => assertShiftStatusTransition('completed', 'scheduled')).toThrow('not allowed');
    expect(() => assertShiftStatusTransition('active', 'scheduled')).not.toThrow();
    expect(() => assertShiftStatusTransition('active', 'completed')).not.toThrow();
    expect(() => assertShiftStatusTransition('active', 'cancelled')).not.toThrow();
    expect(() => assertShiftStatusTransition('active', 'missed')).toThrow('not allowed');
  });

  it('marks only overdue scheduled shifts as eligible to become missed', () => {
    const now = new Date('2026-07-16T00:00:00+03:00');
    expect(canMarkShiftMissed(createShift(), now)).toBe(true);
    expect(canMarkShiftMissed(createShift({ status: 'cancelled' }), now)).toBe(false);
    expect(canMarkShiftMissed(createShift(), new Date('2026-07-15T18:00:00+03:00'))).toBe(false);
  });
});
