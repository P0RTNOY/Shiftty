import { hasCalculationProfileChange } from './salary-profile-versioning';
import { createSalaryProfile } from '@/test/fixtures';

describe('salary profile versioning', () => {
  const current = createSalaryProfile({
    baseHourlyRateMinor: 6000,
    workweekStartWeekday: 0,
    weeklyOvertimeEnabled: true,
    weeklyRegularMinutes: 2520,
    weeklyOvertimeMultiplierBasisPoints: 12500,
    weeklyOvertimeBasis: 'net',
  });

  it.each([
    ['workweek start', { workweekStartWeekday: 1 }],
    ['weekly threshold', { weeklyRegularMinutes: 2400 }],
    ['weekly multiplier', { weeklyOvertimeMultiplierBasisPoints: 15000 }],
    ['weekly basis', { weeklyOvertimeBasis: 'gross' as const }],
    ['weekly opt-out', { weeklyOvertimeEnabled: false }],
  ])('requires an effective-dated profile version for a %s change', (_label, change) => {
    expect(hasCalculationProfileChange(current, { ...current, ...change })).toBe(true);
  });

  it('does not version a profile when calculation settings are unchanged', () => {
    expect(hasCalculationProfileChange(current, { ...current })).toBe(false);
  });
});
