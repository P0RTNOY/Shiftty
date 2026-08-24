import { calculateSalary, deriveSalaryTrustState } from '@/domain/services';
import { createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';

const calculatedAt = '2026-08-24T12:00:00+03:00';
const shift = createShift({
  scheduledStart: '2026-08-24T08:00:00+03:00',
  scheduledEnd: '2026-08-24T16:00:00+03:00',
  expectedBreakMinutes: 0,
  hourlyRateSnapshotMinor: 0,
});

function calculate(rules = [createPayRule({
  id: 'configured-overtime-opt-out',
  isEnabled: false,
  conditions: [{ type: 'workedMinutes', afterMinutes: 480, scope: 'shift', basis: 'net' }],
  effect: { type: 'multiplier', basisPoints: 12_500 },
})]) {
  return calculateSalary({
    shift,
    profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
    rules,
    breaks: [],
    holidayIntervals: [],
    calculatedAt,
  });
}

describe('salary trust state', () => {
  it('keeps absent, incomplete, error, and stale salary unavailable', () => {
    expect(deriveSalaryTrustState()).toBe('unavailable');
    expect(deriveSalaryTrustState({ ...calculate(), totalGrossPayMinor: undefined })).toBe('unavailable');
    expect(deriveSalaryTrustState({
      ...calculate(),
      issues: [{ code: 'missing_rate', severity: 'error', messageKey: 'salary.missingConfig' }],
    })).toBe('unavailable');
    expect(deriveSalaryTrustState(calculate(), 'stale')).toBe('unavailable');
  });

  it('classifies the default overtime model as a basic estimate even below its threshold', () => {
    const result = calculate([]);

    expect(result.appliedRuleIds).not.toContain('system-default-overtime-8-to-10-hours');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'default_overtime_applied' }));
    expect(deriveSalaryTrustState(result, 'estimated')).toBe('basic_estimate');
  });

  it('classifies a complete result with explicit overtime configuration as configured', () => {
    expect(deriveSalaryTrustState(calculate(), 'finalized')).toBe('configured_estimate');
  });

  it('classifies successfully evaluated weekly overtime as configured even alongside default shift tiers', () => {
    const result = calculate([]);
    result.explanations.push('salary.explanations.weekly_overtime:system-weekly-overtime:profile-1:2520:12500:net');

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'default_overtime_applied' }));
    expect(deriveSalaryTrustState(result, 'estimated')).toBe('configured_estimate');
  });

  it('keeps a finalized zero numeric and classifies it as an estimate', () => {
    const result = { ...calculate(), totalGrossPayMinor: 0 };

    expect(deriveSalaryTrustState(result, 'finalized')).toBe('configured_estimate');
    expect(result.totalGrossPayMinor).toBe(0);
  });

  it('does not mutate an immutable historical calculation while deriving trust', () => {
    const result = calculate([]);
    const before = JSON.stringify(result);

    deriveSalaryTrustState(result, 'finalized');

    expect(JSON.stringify(result)).toBe(before);
  });
});
