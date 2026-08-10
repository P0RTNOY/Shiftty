import { classifyManualShiftRange } from '@/domain/services/manual-shift-classification-service';

const now = new Date('2026-08-10T12:00:00+03:00');

describe('classifyManualShiftRange', () => {
  it.each([
    ['past day', '2026-08-08', '05:30', '14:00'],
    ['completed earlier today', '2026-08-10', '05:30', '11:00'],
    ['completed cross-midnight', '2026-08-08', '22:00', '06:00'],
  ])('classifies %s as completed', (_label, date, startTime, endTime) => {
    expect(classifyManualShiftRange({ date, startTime, endTime, now })).toMatchObject({ kind: 'completed' });
  });

  it.each([
    ['tomorrow', '2026-08-11', '08:00', '16:00'],
    ['future cross-midnight', '2026-08-10', '22:00', '06:00'],
  ])('classifies %s as scheduled', (_label, date, startTime, endTime) => {
    expect(classifyManualShiftRange({ date, startTime, endTime, now })).toMatchObject({ kind: 'scheduled' });
  });

  it('requires a contextual decision when the selected range overlaps now', () => {
    expect(classifyManualShiftRange({ date: '2026-08-10', startTime: '11:00', endTime: '13:00', now })).toMatchObject({ kind: 'overlapsNow' });
  });

  it('rejects equal times instead of guessing a 24-hour shift', () => {
    expect(() => classifyManualShiftRange({ date: '2026-08-10', startTime: '08:00', endTime: '08:00', now })).toThrow('identical');
  });

  it('uses zoned instants through a DST-sensitive range', () => {
    const result = classifyManualShiftRange({ date: '2026-03-27', startTime: '00:00', endTime: '04:00', now, timezone: 'Asia/Jerusalem' });
    expect(result).toMatchObject({ kind: 'completed', range: { durationMinutes: 180 } });
  });
});
