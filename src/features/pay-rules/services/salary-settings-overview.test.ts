import { buildSalarySettingsOverview, localDateInTimeZone } from '@/features/pay-rules/services/salary-settings-overview';
import { createCalendarEvidenceInterval, createPayRule, createSalaryProfile, createWeeklyRestSchedule } from '@/test/fixtures';

describe('salary settings overview', () => {
  it('reports a complete weekly-rest and holiday setup only when both evidence and rates exist', () => {
    const profile = createSalaryProfile({ weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2_520, weeklyOvertimeMultiplierBasisPoints: 12_500 });
    const overview = buildSalarySettingsOverview({
      profile,
      weeklyRest: createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' }),
      intervals: [createCalendarEvidenceInterval({ type: 'holiday' })],
      rules: [
        createPayRule({ id: 'rest', premiumFamily: 'special_interval', conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }], effect: { type: 'multiplier', basisPoints: 15_000 } }),
        createPayRule({ id: 'holiday', premiumFamily: 'special_interval', conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }], effect: { type: 'multiplier', basisPoints: 15_000 } }),
      ],
    });

    expect(overview).toEqual({
      holidayIntervalCount: 1,
      holidayStatus: 'configured',
      overtimeStatus: 'configured',
      weeklyRestRateBasisPoints: 15_000,
      weeklyRestStatus: 'configured',
    });
  });

  it('surfaces partial and missing configuration instead of claiming readiness', () => {
    const overview = buildSalarySettingsOverview({
      profile: createSalaryProfile(),
      weeklyRest: createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' }),
      intervals: [],
      rules: [],
    });
    expect(overview.weeklyRestStatus).toBe('needs_attention');
    expect(overview.holidayStatus).toBe('not_configured');
    expect(overview.overtimeStatus).toBe('not_configured');
  });

  it('derives the effective local date in the salary profile timezone', () => {
    expect(localDateInTimeZone('Asia/Jerusalem', new Date('2026-08-31T21:30:00Z'))).toBe('2026-09-01');
    expect(localDateInTimeZone('America/New_York', new Date('2026-09-01T02:30:00Z'))).toBe('2026-08-31');
  });
});
