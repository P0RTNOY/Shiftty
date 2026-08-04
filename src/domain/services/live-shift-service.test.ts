import {
  buildEndShiftReview,
  calculateLiveShiftMetrics,
  isActiveShiftStale,
  resolveExpectedEnd,
} from '@/domain/services/live-shift-service';
import { createBreak, createShift } from '@/test/fixtures';

describe('live shift calculations', () => {
  const active = createShift({
    status: 'active',
    actualStart: '2026-07-15T13:00:00+03:00',
    expectedEnd: '2026-07-15T22:00:00+03:00',
    activeOrigin: 'scheduled',
  });
  const now = new Date('2026-07-15T17:00:00+03:00');

  it('uses absolute timestamps as the live source of truth', () => {
    expect(calculateLiveShiftMetrics(active, [], now)).toEqual({
      elapsedMinutes: 240,
      paidBreakMinutes: 0,
      unpaidBreakMinutes: 0,
      activeBreakMinutes: 0,
      netWorkedMinutes: 240,
      isOnBreak: false,
    });
  });

  it('preserves paid breaks while deducting completed and active unpaid breaks', () => {
    const breaks = [
      createBreak({ id: 'paid', start: '2026-07-15T14:00:00+03:00', end: '2026-07-15T14:15:00+03:00', isPaid: true }),
      createBreak({ id: 'unpaid', start: '2026-07-15T15:00:00+03:00', end: '2026-07-15T15:30:00+03:00' }),
      createBreak({ id: 'open', start: '2026-07-15T16:50:00+03:00', end: undefined }),
    ];
    expect(calculateLiveShiftMetrics(active, breaks, now)).toEqual({
      elapsedMinutes: 240,
      paidBreakMinutes: 15,
      unpaidBreakMinutes: 40,
      activeBreakMinutes: 10,
      netWorkedMinutes: 200,
      isOnBreak: true,
    });
  });

  it('handles cross-midnight and DST changes by comparing instants', () => {
    const crossMidnight = createShift({ status: 'active', actualStart: '2026-07-15T22:00:00+03:00', activeOrigin: 'unscheduled' });
    expect(calculateLiveShiftMetrics(crossMidnight, [], new Date('2026-07-16T02:00:00+03:00')).elapsedMinutes).toBe(240);

    const dst = createShift({ status: 'active', actualStart: '2026-10-25T00:30:00+03:00', activeOrigin: 'unscheduled' });
    expect(calculateLiveShiftMetrics(dst, [], new Date('2026-10-25T02:30:00+02:00')).elapsedMinutes).toBe(180);
  });

  it('detects stale sessions without mutating them', () => {
    expect(isActiveShiftStale(active, now, 16 * 60)).toBe(false);
    expect(isActiveShiftStale(active, new Date('2026-07-16T06:00:00+03:00'), 16 * 60)).toBe(true);
  });

  it('keeps an explicit expected end separate from the scheduled end', () => {
    expect(resolveExpectedEnd(active)).toBe('2026-07-15T22:00:00+03:00');
    expect(resolveExpectedEnd(createShift({ status: 'active', actualStart: active.actualStart, activeOrigin: 'scheduled', expectedEnd: undefined }))).toBe(active.scheduledEnd);
  });

  it('builds the review without losing scheduled, actual, or break details', () => {
    expect(buildEndShiftReview(active, [createBreak()], '2026-07-15T22:00:00+03:00')).toMatchObject({
      scheduledMinutes: 510,
      actualMinutes: 540,
      paidBreakMinutes: 0,
      unpaidBreakMinutes: 30,
      netActualMinutes: 510,
    });
  });
});
