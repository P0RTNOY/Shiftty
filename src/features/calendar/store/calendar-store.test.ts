import { getCalendarToday } from '@/features/calendar/store/calendar-store';

describe('Calendar initial date', () => {
  it('uses the application timezone around the UTC date boundary', () => {
    expect(getCalendarToday(new Date('2026-08-31T21:30:00.000Z'))).toBe('2026-09-01');
    expect(getCalendarToday(new Date('2026-09-01T20:30:00.000Z'))).toBe('2026-09-01');
  });
});
