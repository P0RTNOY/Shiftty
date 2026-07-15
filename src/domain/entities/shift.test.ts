import { shiftSchema } from '@/domain/entities/shift';
import { createShift } from '@/test/fixtures';

describe('shiftSchema', () => {
  it('preserves scheduled, actual, and payable ranges independently', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:24:00+03:00',
      actualEnd: '2026-07-15T22:07:00+03:00',
      payableStart: '2026-07-15T13:30:00+03:00',
      payableEnd: '2026-07-15T22:00:00+03:00',
    });

    expect(shift.scheduledStart).toBe('2026-07-15T13:30:00+03:00');
    expect(shift.actualStart).toBe('2026-07-15T13:24:00+03:00');
    expect(shift.payableStart).toBe('2026-07-15T13:30:00+03:00');
  });

  it('rejects floating-point money and backwards absolute ranges', () => {
    expect(() => createShift({ hourlyRateSnapshotMinor: 4500.5 })).toThrow();
    expect(() =>
      createShift({
        scheduledStart: '2026-07-15T22:00:00+03:00',
        scheduledEnd: '2026-07-15T13:30:00+03:00',
      }),
    ).toThrow('End time must be after start time.');
  });

  it('requires tracking timestamps for active and completed states', () => {
    expect(() => createShift({ status: 'active' })).toThrow('actual start');
    expect(() =>
      shiftSchema.parse({
        ...createShift(),
        status: 'completed',
        actualStart: '2026-07-15T13:30:00+03:00',
      }),
    ).toThrow('actual start and end');
  });
});
