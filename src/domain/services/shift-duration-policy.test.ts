import {
  assertDefaultShiftDurationWithinLimit,
  assertShiftDurationWithinLimit,
  getDefaultShiftDurationMinutes,
} from '@/domain/services/shift-duration-policy';

describe('12-hour shift duration policy', () => {
  it('accepts exactly 12 hours and rejects one minute more', () => {
    expect(() => assertShiftDurationWithinLimit(
      '2026-08-01T08:00:00+03:00',
      '2026-08-01T20:00:00+03:00',
    )).not.toThrow();
    expect(() => assertShiftDurationWithinLimit(
      '2026-08-01T08:00:00+03:00',
      '2026-08-01T20:01:00+03:00',
    )).toThrow('cannot exceed 12 hours');
  });

  it('validates cross-midnight shift-type defaults by nominal duration', () => {
    expect(getDefaultShiftDurationMinutes('22:00', '10:00')).toBe(720);
    expect(() => assertDefaultShiftDurationWithinLimit('22:00', '10:00')).not.toThrow();
    expect(() => assertDefaultShiftDurationWithinLimit('22:00', '10:01')).toThrow('cannot exceed 12 hours');
  });

  it('uses elapsed instants around daylight-saving transitions', () => {
    expect(() => assertShiftDurationWithinLimit(
      '2026-10-25T00:00:00+03:00',
      '2026-10-25T11:00:00+02:00',
    )).not.toThrow();
    expect(() => assertShiftDurationWithinLimit(
      '2026-10-25T00:00:00+03:00',
      '2026-10-25T11:01:00+02:00',
    )).toThrow('cannot exceed 12 hours');
  });

  it('grandfathers only an existing longer duration and rejects lengthening it', () => {
    expect(() => assertShiftDurationWithinLimit(
      '2026-08-01T08:00:00+03:00',
      '2026-08-01T21:00:00+03:00',
      780,
    )).not.toThrow();
    expect(() => assertShiftDurationWithinLimit(
      '2026-08-01T08:00:00+03:00',
      '2026-08-01T21:01:00+03:00',
      780,
    )).toThrow('cannot exceed 12 hours');
  });
});
