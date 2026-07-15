import { calculateShiftDuration } from '@/domain/services/shift-time-service';
import { createBreak, createShift } from '@/test/fixtures';

describe('calculateShiftDuration', () => {
  it('uses the expected break for a scheduled shift', () => {
    const result = calculateShiftDuration(createShift(), 'scheduled');

    expect(result).toEqual({ grossMinutes: 510, unpaidBreakMinutes: 30, paidMinutes: 480 });
  });

  it('deducts unpaid sessions but preserves paid breaks', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:24:00+03:00',
      actualEnd: '2026-07-15T22:07:00+03:00',
    });
    const result = calculateShiftDuration(shift, 'actual', [
      createBreak(),
      createBreak({
        id: 'break-2',
        start: '2026-07-15T19:00:00+03:00',
        end: '2026-07-15T19:12:00+03:00',
        isPaid: true,
      }),
    ]);

    expect(result).toEqual({ grossMinutes: 523, unpaidBreakMinutes: 30, paidMinutes: 493 });
  });

  it('returns null when clock-out is missing', () => {
    const active = createShift({
      status: 'active',
      actualStart: '2026-07-15T13:24:00+03:00',
    });

    expect(calculateShiftDuration(active, 'actual')).toBeNull();
  });

  it('rejects overlapping and out-of-range breaks', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:30:00+03:00',
      actualEnd: '2026-07-15T22:00:00+03:00',
    });
    expect(() =>
      calculateShiftDuration(shift, 'actual', [
        createBreak(),
        createBreak({
          id: 'break-2',
          start: '2026-07-15T17:20:00+03:00',
          end: '2026-07-15T17:40:00+03:00',
        }),
      ]),
    ).toThrow('overlap');
    expect(() =>
      calculateShiftDuration(shift, 'actual', [
        createBreak({
          start: '2026-07-15T12:00:00+03:00',
          end: '2026-07-15T12:15:00+03:00',
        }),
      ]),
    ).toThrow('contained');
  });

  it('keeps payable duration separate from actual duration', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:24:00+03:00',
      actualEnd: '2026-07-15T22:07:00+03:00',
      payableStart: '2026-07-15T13:30:00+03:00',
      payableEnd: '2026-07-15T22:00:00+03:00',
      actualBreakMinutes: 42,
      payableBreakMinutes: 30,
    });

    expect(calculateShiftDuration(shift, 'actual')?.paidMinutes).toBe(481);
    expect(calculateShiftDuration(shift, 'payable')?.paidMinutes).toBe(480);
  });
});
