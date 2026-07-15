import { resolveLocalShiftRange } from '@/shared/utils/zoned-time';

describe('resolveLocalShiftRange', () => {
  it('resolves a cross-midnight shift onto the following day', () => {
    const range = resolveLocalShiftRange('2026-07-15', '22:00', '06:00');

    expect(range.crossesMidnight).toBe(true);
    expect(range.durationMinutes).toBe(480);
    expect(range.end).toContain('2026-07-16T06:00:00.000+03:00');
  });

  it('handles a cross-month shift', () => {
    const range = resolveLocalShiftRange('2026-07-31', '22:00', '02:00');

    expect(range.durationMinutes).toBe(240);
    expect(range.end).toContain('2026-08-01T02:00:00.000+03:00');
  });

  it('accounts for Jerusalem daylight-saving changes', () => {
    const springForward = resolveLocalShiftRange('2026-03-27', '00:00', '04:00');
    const fallBack = resolveLocalShiftRange('2026-10-25', '00:00', '04:00');

    expect(springForward.durationMinutes).toBe(180);
    expect(fallBack.durationMinutes).toBe(300);
  });

  it('rejects invalid dates, times, and identical endpoints', () => {
    expect(() => resolveLocalShiftRange('2026-02-30', '08:00', '16:00')).toThrow('valid');
    expect(() => resolveLocalShiftRange('2026-07-15', '25:00', '16:00')).toThrow('24-hour');
    expect(() => resolveLocalShiftRange('2026-07-15', '08:00', '08:00')).toThrow('identical');
  });
});
