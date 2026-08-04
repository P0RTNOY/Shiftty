import { buildMonthGrid, groupShiftsByLocalDate, summarizeShifts } from '@/domain/services/calendar-service';
import { createShift } from '@/test/fixtures';

describe('calendar services', () => {
  it('builds locale-aware six-week month grids', () => {
    const sundayGrid = buildMonthGrid('2026-08-01', 0);
    const mondayGrid = buildMonthGrid('2026-08-01', 1);

    expect(sundayGrid).toHaveLength(42);
    expect(sundayGrid[0]?.localDate).toBe('2026-07-26');
    expect(mondayGrid[0]?.localDate).toBe('2026-07-27');
  });

  it('groups multiple and cross-midnight shifts by their start date', () => {
    const shifts = [
      createShift({ id: 'one' }),
      createShift({ id: 'two', scheduledStart: '2026-07-15T23:00:00+03:00', scheduledEnd: '2026-07-16T04:00:00+03:00' }),
    ];

    expect(groupShiftsByLocalDate(shifts, 'Asia/Jerusalem').get('2026-07-15')).toHaveLength(2);
  });

  it('summarizes completed and upcoming shifts without salary calculations', () => {
    const completed = createShift({
      id: 'done',
      status: 'completed',
      actualStart: '2026-07-15T13:30:00+03:00',
      actualEnd: '2026-07-15T22:00:00+03:00',
      payableStart: '2026-07-15T13:30:00+03:00',
      payableEnd: '2026-07-15T22:00:00+03:00',
      payableBreakMinutes: 30,
    });
    const upcoming = createShift({ id: 'future', scheduledStart: '2026-08-10T08:00:00+03:00', scheduledEnd: '2026-08-10T16:00:00+03:00' });
    const stats = summarizeShifts([completed, upcoming], new Date('2026-08-03T10:00:00+03:00'));

    expect(stats).toEqual({ completedCount: 1, scheduledCount: 1, workedMinutes: 480, upcomingMinutes: 450 });
  });
});
