import { findShiftOverlaps, getEffectiveShiftRange, shiftsOverlap } from '@/domain/services/shift-overlap-service';
import { createShift } from '@/test/fixtures';

describe('shift overlap detection', () => {
  it('detects same-day and cross-workplace overlaps', () => {
    const candidate = createShift({ id: 'candidate' });
    const overlap = createShift({
      id: 'overlap',
      workplaceId: 'workplace-2',
      scheduledStart: '2026-07-15T21:30:00+03:00',
      scheduledEnd: '2026-07-16T02:00:00+03:00',
    });

    expect(shiftsOverlap(candidate, overlap)).toBe(true);
    expect(findShiftOverlaps(candidate, [overlap])).toEqual([overlap]);
  });

  it('treats adjacent shifts as non-overlapping', () => {
    const first = createShift();
    const second = createShift({
      id: 'shift-2',
      scheduledStart: first.scheduledEnd,
      scheduledEnd: '2026-07-16T02:00:00+03:00',
    });

    expect(shiftsOverlap(first, second)).toBe(false);
  });

  it('ignores cancelled shifts and the occurrence being edited', () => {
    const candidate = createShift({ id: 'shift-1' });
    const cancelled = createShift({ id: 'cancelled', status: 'cancelled' });

    expect(findShiftOverlaps(candidate, [candidate, cancelled])).toEqual([]);
  });

  it('detects overlaps using actual ranges when schedules are unknown', () => {
    const historical = createShift({
      id: 'historical',
      status: 'completed',
      scheduledStart: undefined,
      scheduledEnd: undefined,
      actualStart: '2026-07-15T23:00:00+03:00',
      actualEnd: '2026-07-16T03:00:00+03:00',
      payableStart: '2026-07-15T23:00:00+03:00',
      payableEnd: '2026-07-16T03:00:00+03:00',
    });
    const planned = createShift({
      id: 'planned',
      scheduledStart: '2026-07-16T02:30:00+03:00',
      scheduledEnd: '2026-07-16T06:00:00+03:00',
    });

    expect(shiftsOverlap(historical, planned)).toBe(true);
  });

  it('uses actual work instead of a stale schedule for completed shifts', () => {
    const completed = createShift({
      status: 'completed',
      scheduledStart: '2026-08-07T08:00:00+03:00',
      scheduledEnd: '2026-08-07T16:00:00+03:00',
      actualStart: '2026-08-08T17:20:00+03:00',
      actualEnd: '2026-08-09T05:20:00+03:00',
    });

    expect(getEffectiveShiftRange(completed)).toEqual({
      start: '2026-08-08T17:20:00+03:00',
      end: '2026-08-09T05:20:00+03:00',
    });
  });

  it('provides a render-safe range for an open unscheduled active shift', () => {
    const active = createShift({
      status: 'active',
      scheduledStart: undefined,
      scheduledEnd: undefined,
      actualStart: '2026-08-08T17:20:00+03:00',
    });

    expect(getEffectiveShiftRange(active)).toEqual({
      start: '2026-08-08T17:20:00+03:00',
      end: '2026-08-08T17:20:00+03:00',
    });
  });
});
