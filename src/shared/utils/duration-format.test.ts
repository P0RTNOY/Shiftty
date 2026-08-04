import { formatDurationCompact, formatDurationLong } from '@/shared/utils/duration-format';

describe('duration formatting', () => {
  it('formats Hebrew long and compact durations', () => {
    expect(formatDurationLong(510, 'he')).toBe('8 שעות ו־30 דקות');
    expect(formatDurationLong(45, 'he')).toBe('45 דקות');
    expect(formatDurationCompact(555)).toBe('9:15 שעות');
  });

  it('formats English durations for the future locale', () => {
    expect(formatDurationLong(510, 'en')).toBe('8 hours and 30 minutes');
  });
});
