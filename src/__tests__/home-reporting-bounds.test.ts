/**
 * Regression test: Home and Reports dashboard data preparation must share
 * the same application-timezone month-range helper. That helper must not
 * route reporting bounds through resolveLocalShiftRange (which enforces
 * single-shift duration constraints and rejects month-long intervals).
 *
 * This test must live OUTSIDE src/app/ because Expo Router treats every
 * file inside src/app/ as a route module.
 */
import { summarizeShifts } from '@/domain/services';
import type { Shift } from '@/domain/entities';
import { createMonthlyReportRange } from '@/features/reports/monthly-report-service';
import { createShift } from '@/test/fixtures';

describe('Home reporting-bounds preparation', () => {
  it('refreshes the month query immediately after quick clock-out completion', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const source = fs.readFileSync(path.join(path.resolve('.'), 'src', 'app', '(tabs)', 'index.tsx'), 'utf8');

    expect(source).toContain('refresh: refreshShifts');
    expect(source).toMatch(/await active\.completeShift\([\s\S]{0,700}await refreshShifts\(\)/);
  });

  it('uses the shared application-timezone month range on Home', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const source = fs.readFileSync(path.join(path.resolve('.'), 'src', 'app', '(tabs)', 'index.tsx'), 'utf8');

    expect(source).toContain('formatLocalDateKey(new Date(), DEFAULT_TIMEZONE)');
    expect(source).toContain('createMonthlyReportRange(currentMonth, DEFAULT_TIMEZONE)');
    expect(source).not.toContain('resolveLocalDateTime');

    expect(createMonthlyReportRange('2026-09', 'Asia/Jerusalem')).toEqual({
      start: '2026-09-01T00:00:00.000+03:00',
      end: '2026-10-01T00:00:00.000+03:00',
    });
  });

  const testCases = [
    { name: 'February (28 days)', month: '2026-02' },
    { name: 'April (30 days)', month: '2026-04' },
    { name: 'August (31 days)', month: '2026-08' },
    { name: 'December -> January', month: '2026-12' },
  ];

  for (const tc of testCases) {
    it(`handles ${tc.name} in Asia/Jerusalem without throwing`, () => {
      const { start, end } = createMonthlyReportRange(tc.month, 'Asia/Jerusalem');

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
