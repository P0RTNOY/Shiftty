import {
  formatCompactDate,
  formatFullDate,
  formatMonth,
  formatTime,
  formatTimeRange,
} from '@/shared/utils/date-time-format';

describe('canonical date and time formatting', () => {
  it('formats compact and full Hebrew dates consistently', () => {
    const value = '2026-08-08T17:20:00+03:00';

    expect(formatCompactDate(value, 'he', 'Asia/Jerusalem')).toBe('שבת · 8.8');
    expect(formatFullDate(value, 'he', 'Asia/Jerusalem')).toBe('שבת, 8 באוגוסט 2026');
  });

  it('formats ordinary times without seconds and labels cross-midnight ranges', () => {
    const start = '2026-08-08T17:20:00+03:00';
    const end = '2026-08-09T05:20:00+03:00';

    expect(formatTime(start, 'he', 'Asia/Jerusalem')).toBe('17:20');
    expect(formatTimeRange(start, end, 'he', 'Asia/Jerusalem')).toBe('17:20–05:20 למחרת');
  });

  it('uses the application timezone for calendar day and month boundaries', () => {
    const nearMidnightUtc = '2026-08-08T21:30:00.000Z';

    expect(formatCompactDate(nearMidnightUtc, 'he', 'Asia/Jerusalem')).toBe('ראשון · 9.8');
    expect(formatCompactDate(nearMidnightUtc, 'he', 'America/New_York')).toBe('שבת · 8.8');
    expect(formatMonth('2026-08', 'he')).toBe('אוגוסט 2026');
  });
});
