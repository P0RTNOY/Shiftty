import { resolveActiveCalculationEnd } from '@/features/pay-rules/services/active-calculation-time';

describe('resolveActiveCalculationEnd', () => {
  it.each([
    ['2026-08-10T10:22:59.000Z', '2026-08-10T10:23:00.001Z'],
    ['2026-08-10T10:23:00.000Z', '2026-08-10T10:23:00.001Z'],
    ['2026-08-10T10:23:30.000Z', '2026-08-10T10:23:30.000Z'],
  ])('keeps a provisional end strictly after the active start', (candidate, expected) => {
    expect(resolveActiveCalculationEnd('2026-08-10T10:23:00.000Z', candidate)).toBe(expected);
  });
});
