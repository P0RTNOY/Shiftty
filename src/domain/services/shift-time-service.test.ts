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

    expect(calculateShiftDuration(shift, 'payable')?.paidMinutes).toBe(480);
  });

  describe('temporal validity and boundary checks', () => {
    it('allows 1 millisecond shift (returns 0 minutes)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:00:00.001Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(0);
    });

    it('allows 1 second shift (returns 0 minutes)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:00:01.000Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(0);
    });

    it('allows 17 seconds shift (returns 0 minutes)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:04:43.295Z',
        actualEnd: '2026-08-07T12:05:00.000Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(0);
    });

    it('allows 59.999 seconds shift (returns 0 minutes)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:00:59.999Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(0);
    });

    it('allows exactly 60 seconds shift (returns 1 minute)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:01:00.000Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(1);
    });

    it('allows 1 minute + 1 second shift (returns 1 minute)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:01:01.000Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(1);
    });

    it('allows normal 8-hour shift', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T08:00:00+03:00',
        actualEnd: '2026-08-07T16:00:00+03:00',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(480);
    });

    it('allows valid cross-midnight shift', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T22:00:00+03:00',
        actualEnd: '2026-08-08T06:00:00+03:00',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(480);
    });

    it('throws END_NOT_AFTER_START if end == start', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-07T12:01:00.000Z',
      });
      const corrupt = { ...shift, actualStart: '2026-08-07T12:00:00.000Z', actualEnd: '2026-08-07T12:00:00.000Z' };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Shift end must be after shift start.');
    });

    it('throws END_NOT_AFTER_START if end is 1 ms before start', () => {
      const corrupt = {
        ...createShift(),
        actualStart: '2026-08-07T12:00:00.001Z',
        actualEnd: '2026-08-07T12:00:00.000Z',
      };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Shift end must be after shift start.');
    });

    it('throws INVALID_TIMESTAMP for malformed start timestamp', () => {
      const corrupt = {
        ...createShift(),
        actualStart: 'invalid-date',
        actualEnd: '2026-08-07T12:00:00.000Z',
      };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Invalid timestamps provided for shift calculation.');
    });

    it('throws INVALID_TIMESTAMP for malformed end timestamp', () => {
      const corrupt = {
        ...createShift(),
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: 'not-a-date',
      };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Invalid timestamps provided for shift calculation.');
    });

    it('allows exactly at supported maximum (24 hours)', () => {
      const shift = createShift({
        status: 'completed',
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-08T12:00:00.000Z',
      });
      const result = calculateShiftDuration(shift, 'actual');
      expect(result?.paidMinutes).toBe(1440);
    });

    it('throws DURATION_EXCEEDS_LIMIT if 1 ms above supported maximum', () => {
      const corrupt = {
        ...createShift(),
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-08T12:00:00.001Z',
      };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Shift duration exceeds the supported 24-hour safety limit.');
    });

    it('throws DURATION_EXCEEDS_LIMIT if 30 seconds above supported maximum', () => {
      const corrupt = {
        ...createShift(),
        actualStart: '2026-08-07T12:00:00.000Z',
        actualEnd: '2026-08-08T12:00:30.000Z',
      };
      expect(() => calculateShiftDuration(corrupt, 'actual')).toThrow('Shift duration exceeds the supported 24-hour safety limit.');
    });
  });
});
