import { roundTimestamp, selectPayableTime } from '@/domain/services/payable-time-service';
import { createShift } from '@/test/fixtures';

describe('payable time selection and rounding', () => {
  const shift = createShift({
    status: 'active',
    actualStart: '2026-07-15T13:24:00+03:00',
    activeOrigin: 'scheduled',
  });
  const actualEnd = '2026-07-15T22:07:00+03:00';

  it('selects actual, scheduled, and manual ranges independently', () => {
    expect(selectPayableTime({ shift, actualEnd, unpaidBreakMinutes: 32, source: 'actual' })).toEqual({ payableStart: shift.actualStart, payableEnd: actualEnd, payableBreakMinutes: 32, payableSource: 'actual' });
    expect(selectPayableTime({ shift, actualEnd, unpaidBreakMinutes: 32, source: 'scheduled' })).toEqual({ payableStart: shift.scheduledStart, payableEnd: shift.scheduledEnd, payableBreakMinutes: 32, payableSource: 'scheduled' });
    expect(selectPayableTime({ shift, actualEnd, unpaidBreakMinutes: 32, source: 'manual', manual: { start: '2026-07-15T13:30:00+03:00', end: '2026-07-15T22:00:00+03:00', breakMinutes: 30 } })).toEqual({ payableStart: '2026-07-15T13:30:00+03:00', payableEnd: '2026-07-15T22:00:00+03:00', payableBreakMinutes: 30, payableSource: 'manual' });
  });

  it('rejects scheduled selection when no scheduled range exists', () => {
    expect(() => selectPayableTime({ shift: createShift({ status: 'active', scheduledStart: undefined, scheduledEnd: undefined, actualStart: shift.actualStart, activeOrigin: 'unscheduled' }), actualEnd, unpaidBreakMinutes: 0, source: 'scheduled' })).toThrow('Scheduled');
  });

  it.each([
    ['nearest', '2026-07-15T13:25:00.000Z'],
    ['floor', '2026-07-15T13:20:00.000Z'],
    ['ceiling', '2026-07-15T13:25:00.000Z'],
  ] as const)('rounds using %s mode', (mode, expected) => {
    expect(roundTimestamp('2026-07-15T13:23:00.000Z', 5, mode)).toBe(expected);
  });

  it('returns a rounded payable source and validates supported increments', () => {
    expect(selectPayableTime({ shift, actualEnd, unpaidBreakMinutes: 32, source: 'rounded', rounding: { incrementMinutes: 15, mode: 'nearest' } })).toMatchObject({ payableStart: '2026-07-15T10:30:00.000Z', payableEnd: '2026-07-15T19:00:00.000Z', payableSource: 'rounded' });
    expect(() => roundTimestamp(actualEnd, 7, 'nearest')).toThrow('increment');
  });
});
