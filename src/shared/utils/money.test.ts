import { formatMinorUnits, parseCurrencyToMinor, parsePercentageToBasisPoints, roundRationalToMinor } from '@/shared/utils/money';
import { payRuleSchema } from '@/domain/entities';
import { createPayRule } from '@/test/fixtures';

describe('minor-unit money helpers', () => {
  it.each([['58', 5800], ['58.5', 5850], ['58.50', 5850], ['0.01', 1]])('parses %s without floating point', (value, expected) => expect(parseCurrencyToMinor(value)).toBe(expected));
  it.each(['-1', '58.501', 'abc', '', '1,000', '999999999999999999'])('rejects invalid currency input %s', (value) => expect(() => parseCurrencyToMinor(value)).toThrow());
  it('rounds fractional agorot centrally', () => {
    expect(roundRationalToMinor(1n, 2n, 'half_up')).toBe(1);
    expect(roundRationalToMinor(1n, 2n, 'floor')).toBe(0);
    expect(roundRationalToMinor(1n, 2n, 'ceiling')).toBe(1);
    expect(roundRationalToMinor(2n, 3n, 'half_up')).toBe(1);
  });
  it('formats Hebrew and English currency through Intl', () => {
    expect(formatMinorUnits(5850, 'ILS', 'he')).toContain('58.50');
    expect(formatMinorUnits(5850, 'ILS', 'en')).toContain('58.50');
  });
  it('parses multiplier percentages directly to integer basis points', () => {
    expect(parsePercentageToBasisPoints('125')).toBe(12500);
    expect(parsePercentageToBasisPoints('150.25')).toBe(15025);
    expect(() => parsePercentageToBasisPoints('125.001')).toThrow();
  });
  it('rejects multiplier effects below the supported 100% floor', () => {
    expect(payRuleSchema.safeParse({ ...createPayRule(), effect: { type: 'multiplier', basisPoints: 5000 } }).success).toBe(false);
  });
  it('rejects zero-length weekend windows and inverted threshold bounds', () => {
    expect(payRuleSchema.safeParse({ ...createPayRule(), conditions: [{ type: 'weekend', startWeekday: 5, startTime: '18:00', endWeekday: 5, endTime: '18:00' }] }).success).toBe(false);
    expect(payRuleSchema.safeParse({ ...createPayRule(), conditions: [{ type: 'workedMinutes', afterMinutes: 480, beforeMinutes: 300, scope: 'shift', basis: 'net' }] }).success).toBe(false);
  });
});
