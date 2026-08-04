import { detectHistoricalPatterns } from '@/domain/services/historical-pattern-service';
import type { Shift } from '@/domain/entities';

const TIMEZONE = 'Asia/Jerusalem';

function makeShift(id: string, actualStart: string, actualEnd: string, workplaceId = 'wp-1', roleId?: string): Shift {
  return {
    id,
    status: 'completed',
    workplaceId,
    roleId,
    actualStart,
    actualEnd,
    actualBreakMinutes: 30,
    expectedBreakMinutes: 0,
    hourlyRateSnapshotMinor: 3000,
    salaryCalculationStatus: 'finalized',
    timezone: TIMEZONE,
    createdAt: '2026-01-01T00:00:00+03:00',
    updatedAt: '2026-01-01T00:00:00+03:00',
  };
}

// All on Monday (weekday = 1)
const MONDAY_SHIFTS = [
  makeShift('s1', '2026-07-28T08:05:00+03:00', '2026-07-28T16:10:00+03:00'),
  makeShift('s2', '2026-07-21T08:00:00+03:00', '2026-07-21T15:58:00+03:00'),
  makeShift('s3', '2026-07-14T08:15:00+03:00', '2026-07-14T16:05:00+03:00'),
  makeShift('s4', '2026-07-07T07:55:00+03:00', '2026-07-07T16:00:00+03:00'),
];

describe('detectHistoricalPatterns', () => {
  it('detects a pattern from 4+ Monday shifts', () => {
    const patterns = detectHistoricalPatterns(MONDAY_SHIFTS, TIMEZONE);
    expect(patterns).toHaveLength(1);
    const pattern = patterns[0]!;
    expect(pattern.weekday).toBe(1);
    expect(pattern.workplaceId).toBe('wp-1');
    expect(pattern.observationCount).toBe(4);
    // Median start should be around 08:00-08:10
    expect(pattern.medianStartTime).toMatch(/^08:/);
    // Median end should be around 16:00
    expect(pattern.medianEndTime).toMatch(/^1[56]:/);
  });

  it('returns no patterns when fewer than 3 observations', () => {
    const patterns = detectHistoricalPatterns([MONDAY_SHIFTS[0]!, MONDAY_SHIFTS[1]!], TIMEZONE);
    expect(patterns).toHaveLength(0);
  });

  it('separates patterns by workplaceId', () => {
    const mixedShifts = [
      makeShift('a1', '2026-07-28T08:00:00+03:00', '2026-07-28T16:00:00+03:00', 'wp-1'),
      makeShift('a2', '2026-07-21T08:00:00+03:00', '2026-07-21T16:00:00+03:00', 'wp-1'),
      makeShift('a3', '2026-07-14T08:00:00+03:00', '2026-07-14T16:00:00+03:00', 'wp-1'),
      makeShift('b1', '2026-07-28T09:00:00+03:00', '2026-07-28T17:00:00+03:00', 'wp-2'),
      makeShift('b2', '2026-07-21T09:00:00+03:00', '2026-07-21T17:00:00+03:00', 'wp-2'),
      makeShift('b3', '2026-07-14T09:00:00+03:00', '2026-07-14T17:00:00+03:00', 'wp-2'),
    ];
    const patterns = detectHistoricalPatterns(mixedShifts, TIMEZONE);
    expect(patterns).toHaveLength(2);
    const workplaces = patterns.map((p) => p.workplaceId).sort();
    expect(workplaces).toEqual(['wp-1', 'wp-2']);
  });

  it('ignores non-completed shifts', () => {
    const withActive: Shift = { ...MONDAY_SHIFTS[0]!, status: 'active', id: 'active-1' };
    const patterns = detectHistoricalPatterns([...MONDAY_SHIFTS, withActive], TIMEZONE);
    // Should produce exactly 1 pattern from 4 completed shifts
    expect(patterns[0]?.observationCount).toBe(4);
  });

  it('uses patternId as stable identifier', () => {
    const patterns = detectHistoricalPatterns(MONDAY_SHIFTS, TIMEZONE);
    expect(patterns[0]?.patternId).toBe('wp-1__none__1');
  });
});
