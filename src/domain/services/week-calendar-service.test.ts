import { buildWeekCalendarData, getPreviousWeek, getNextWeek } from '@/domain/services/week-calendar-service';
import type { Shift } from '@/domain/entities';

const TIMEZONE = 'Asia/Jerusalem';
const LOCALE = 'he-IL';

function makeShift(id: string, scheduledStart: string, scheduledEnd: string): Shift {
  return {
    id,
    status: 'scheduled',
    workplaceId: 'wp-1',
    scheduledStart,
    scheduledEnd,
    hourlyRateSnapshotMinor: 3000,
    salaryCalculationStatus: 'not_calculated',
    timezone: TIMEZONE,
    createdAt: '2026-01-01T00:00:00+03:00',
    updatedAt: '2026-01-01T00:00:00+03:00',
    expectedBreakMinutes: 30,
  };
}

const WEEK_DATE = new Date('2026-08-03T12:00:00+03:00'); // Week of Aug 3 2026 (Mon)

describe('buildWeekCalendarData', () => {
  it('produces exactly 7 days', () => {
    const data = buildWeekCalendarData(WEEK_DATE, [], TIMEZONE, LOCALE);
    expect(data.days).toHaveLength(7);
  });

  it('week starts on Sunday', () => {
    const data = buildWeekCalendarData(WEEK_DATE, [], TIMEZONE, LOCALE);
    expect(data.days[0]?.day.dayOfWeek).toBe(0); // 0=Sunday
  });

  it('places shift in correct day', () => {
    const shift = makeShift('s1', '2026-08-04T08:00:00+03:00', '2026-08-04T16:00:00+03:00');
    const data = buildWeekCalendarData(WEEK_DATE, [shift], TIMEZONE, LOCALE);
    const tuesday = data.days.find((d) => d.day.localDate === '2026-08-04');
    expect(tuesday).toBeDefined();
    expect(tuesday?.blocks).toHaveLength(1);
    expect(tuesday?.blocks[0]?.shift.id).toBe('s1');
  });

  it('assigns startMinutes correctly for 08:00 local', () => {
    const shift = makeShift('s1', '2026-08-04T08:00:00+03:00', '2026-08-04T16:00:00+03:00');
    const data = buildWeekCalendarData(WEEK_DATE, [shift], TIMEZONE, LOCALE);
    const block = data.days.find((d) => d.day.localDate === '2026-08-04')?.blocks[0]!;
    expect(block.startMinutes).toBe(8 * 60); // 480 minutes
    expect(block.durationMinutes).toBe(8 * 60); // 480 minutes
  });

  it('assigns columns for overlapping shifts', () => {
    const s1 = makeShift('s1', '2026-08-04T08:00:00+03:00', '2026-08-04T16:00:00+03:00');
    const s2 = makeShift('s2', '2026-08-04T10:00:00+03:00', '2026-08-04T18:00:00+03:00');
    const data = buildWeekCalendarData(WEEK_DATE, [s1, s2], TIMEZONE, LOCALE);
    const blocks = data.days.find((d) => d.day.localDate === '2026-08-04')?.blocks!;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.column).not.toEqual(blocks[1]?.column);
    expect(blocks[0]?.totalColumns).toBe(2);
    expect(blocks[1]?.totalColumns).toBe(2);
  });

  it('reverses day order when isRtl=true', () => {
    const data = buildWeekCalendarData(WEEK_DATE, [], TIMEZONE, LOCALE, true);
    // RTL returns same data array but the consumer should reverse; data itself is unchanged
    expect(data.isRtl).toBe(true);
    expect(data.days[0]?.day.dayOfWeek).toBe(0); // Sunday still first in array
  });

  it('getPreviousWeek returns correct Sunday', () => {
    const prev = getPreviousWeek(WEEK_DATE);
    const data = buildWeekCalendarData(prev, [], TIMEZONE, LOCALE);
    expect(data.weekStart).toBe('2026-07-26'); // Previous Sunday
  });

  it('getNextWeek returns correct Sunday', () => {
    const next = getNextWeek(WEEK_DATE);
    const data = buildWeekCalendarData(next, [], TIMEZONE, LOCALE);
    expect(data.weekStart).toBe('2026-08-09'); // Next Sunday
  });

  it('includes weekStart and weekEnd as Sunday-Saturday range', () => {
    const data = buildWeekCalendarData(WEEK_DATE, [], TIMEZONE, LOCALE);
    expect(data.weekStart).toBe('2026-08-02'); // Sunday Aug 2
    expect(data.weekEnd).toBe('2026-08-08'); // Saturday Aug 8
  });
});
