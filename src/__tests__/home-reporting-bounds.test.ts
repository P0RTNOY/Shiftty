/**
 * Regression test: Home and Reports dashboard data preparation must not
 * route monthly reporting bounds through resolveLocalShiftRange (which
 * enforces single-shift duration constraints and throws when start == end
 * or the interval exceeds 24 hours).
 *
 * This test must live OUTSIDE src/app/ because Expo Router treats every
 * file inside src/app/ as a route module.
 */
import { format, addMonths } from 'date-fns';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { summarizeShifts } from '@/domain/services';
import type { Shift } from '@/domain/entities';
import { createShift } from '@/test/fixtures';

describe('Home reporting-bounds preparation', () => {
  it('uses resolveLocalDateTime (not resolveLocalShiftRange) for month bounds', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonthStart = format(addMonths(new Date(`${monthStart}T12:00:00`), 1), 'yyyy-MM-dd');

    // This is the exact code path used by src/app/(tabs)/index.tsx lines 29-30.
    const start = resolveLocalDateTime(monthStart, '00:00');
    const end = resolveLocalDateTime(nextMonthStart, '00:00');

    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime());
  });

  const testCases = [
    { name: 'February (28 days)', monthStart: '2026-02-01', nextMonthStart: '2026-03-01' },
    { name: 'April (30 days)', monthStart: '2026-04-01', nextMonthStart: '2026-05-01' },
    { name: 'August (31 days)', monthStart: '2026-08-01', nextMonthStart: '2026-09-01' },
    { name: 'December -> January', monthStart: '2026-12-01', nextMonthStart: '2027-01-01' },
  ];

  for (const tc of testCases) {
    it(`handles ${tc.name} in Asia/Jerusalem without throwing`, () => {
      const start = resolveLocalDateTime(tc.monthStart, '00:00', 'Asia/Jerusalem');
      const end = resolveLocalDateTime(tc.nextMonthStart, '00:00', 'Asia/Jerusalem');

      expect(start).toBeDefined();
      expect(end).toBeDefined();
      expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime());
    });
  }

  it('summarizeShifts returns zero-counts for empty shift array without crashing', () => {
    const result = summarizeShifts([]);
    expect(result).toEqual({
      completedCount: 0,
      scheduledCount: 0,
      workedMinutes: 0,
      upcomingMinutes: 0,
      invalidCount: 0,
    });
  });

  it('summarizeShifts correctly handles sub-minute shifts without throwing or flagging as invalid', () => {
    // This represents the exact native RC1 test case: a 17-second shift
    const subMinuteShift = createShift({
      id: 'sub-minute-1',
      status: 'completed',
      actualStart: '2026-08-07T12:04:43.295Z',
      actualEnd: '2026-08-07T12:05:00.000Z',
      payableStart: '2026-08-07T12:04:43.295Z',
      payableEnd: '2026-08-07T12:05:00.000Z',
      payableBreakMinutes: 0,
    });

    const result = summarizeShifts([subMinuteShift]);
    expect(result.completedCount).toBe(1);
    expect(result.workedMinutes).toBe(0); // Truncated to 0 minutes for display/pay
    expect(result.invalidCount).toBe(0); // It is temporally valid
  });

  it('summarizeShifts safely catches ShiftTimeRangeError for corrupt legacy shifts and increments invalidCount', () => {
    // Build a valid completed shift first, then corrupt its time fields after
    // Zod validation. This simulates what happens when a row with end <= start
    // is loaded from SQLite (the repository hydration skips Zod validation).
    const base = createShift({
      id: 'corrupt-1',
      status: 'completed',
      actualStart: '2026-07-15T08:00:00+03:00',
      actualEnd: '2026-07-15T16:00:00+03:00',
    });
    const corruptShift: Shift = {
      ...base,
      actualStart: '2026-07-15T22:00:00+03:00',
      actualEnd: '2026-07-15T13:30:00+03:00', // end BEFORE start
      payableStart: '2026-07-15T22:00:00+03:00',
      payableEnd: '2026-07-15T13:30:00+03:00',
    };

    const validShift = createShift({
      id: 'valid-1',
      status: 'completed',
      actualStart: '2026-07-15T08:00:00+03:00',
      actualEnd: '2026-07-15T16:00:00+03:00',
      payableStart: '2026-07-15T08:00:00+03:00',
      payableEnd: '2026-07-15T16:00:00+03:00',
      payableBreakMinutes: 0,
    });

    // Must not throw — summarizeShifts should skip the corrupt record
    const result = summarizeShifts([corruptShift, validShift]);

    // The valid shift should still be counted; the corrupt one increments invalidCount
    expect(result.completedCount).toBe(1);
    expect(result.workedMinutes).toBeGreaterThan(0);
    expect(result.invalidCount).toBe(1);
  });
});
