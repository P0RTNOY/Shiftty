import { matchNearbyScheduledShifts } from '@/domain/services/nearby-shift-service';
import { createShift } from '@/test/fixtures';

describe('nearby scheduled shift matching', () => {
  it('ranks starts that are early or late and recommends a clear closest match', () => {
    const shifts = [
      createShift({ id: 'early', scheduledStart: '2026-07-15T13:30:00+03:00', scheduledEnd: '2026-07-15T22:00:00+03:00' }),
      createShift({ id: 'later', scheduledStart: '2026-07-15T15:00:00+03:00', scheduledEnd: '2026-07-15T23:00:00+03:00' }),
    ];
    const result = matchNearbyScheduledShifts(shifts, new Date('2026-07-15T13:24:00+03:00'), { maximumDifferenceMinutes: 180, timezone: 'Asia/Jerusalem' });
    expect(result.candidates.map((candidate) => candidate.shiftId)).toEqual(['early', 'later']);
    expect(result.candidates[0]).toMatchObject({ absoluteStartDifferenceMinutes: 6, isSameLocalDate: true });
    expect(result.recommendedShiftId).toBe('early');
  });

  it('requires selection when multiple candidates are similarly close', () => {
    const result = matchNearbyScheduledShifts([
      createShift({ id: 'one', scheduledStart: '2026-07-15T13:15:00+03:00', scheduledEnd: '2026-07-15T21:00:00+03:00' }),
      createShift({ id: 'two', scheduledStart: '2026-07-15T13:35:00+03:00', scheduledEnd: '2026-07-15T22:00:00+03:00' }),
    ], new Date('2026-07-15T13:25:00+03:00'));
    expect(result.candidates).toHaveLength(2);
    expect(result.recommendedShiftId).toBeUndefined();
  });

  it('supports a cross-midnight shift and excludes invalid statuses', () => {
    const now = new Date('2026-07-16T00:30:00+03:00');
    const result = matchNearbyScheduledShifts([
      createShift({ id: 'night', scheduledStart: '2026-07-15T22:00:00+03:00', scheduledEnd: '2026-07-16T06:00:00+03:00' }),
      createShift({ id: 'cancelled', status: 'cancelled' }),
      createShift({ id: 'completed', status: 'completed', actualStart: '2026-07-15T13:30:00+03:00', actualEnd: '2026-07-15T22:00:00+03:00' }),
    ], now, { maximumDifferenceMinutes: 180, timezone: 'Asia/Jerusalem' });
    expect(result.candidates.map((candidate) => candidate.shiftId)).toEqual(['night']);
    expect(result.candidates[0]?.isSameLocalDate).toBe(false);
  });

  it('returns no candidate outside the configured window', () => {
    expect(matchNearbyScheduledShifts([createShift()], new Date('2026-07-16T12:00:00+03:00'), { maximumDifferenceMinutes: 120 }).candidates).toEqual([]);
  });
});
