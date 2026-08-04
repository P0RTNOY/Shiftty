import { resolveHourlyRate } from '@/domain/services/rate-resolution-service';
import { createSalaryProfile, createShift } from '@/test/fixtures';

describe('hourly rate resolution', () => {
  const profile = createSalaryProfile({ baseHourlyRateMinor: 5000 });
  it('uses shift override before date, role, profile, and workplace rates', () => expect(resolveHourlyRate({ shift: createShift({ hourlyRateOverrideMinor: 7000 }), profile, roleHourlyRateMinor: 6000, workplaceHourlyRateMinor: 5500, dateOverrideMinor: 6500 })).toMatchObject({ rateMinor: 7000, source: 'shift_override' }));
  it('uses date then role then profile then workplace deterministically', () => {
    const shift = createShift({ hourlyRateSnapshotMinor: 0 });
    expect(resolveHourlyRate({ shift, profile, dateOverrideMinor: 6500, roleHourlyRateMinor: 6000 })).toMatchObject({ rateMinor: 6500, source: 'date_override' });
    expect(resolveHourlyRate({ shift, profile, roleHourlyRateMinor: 6000 })).toMatchObject({ rateMinor: 6000, source: 'role_override' });
    expect(resolveHourlyRate({ shift, profile })).toMatchObject({ rateMinor: 5000, source: 'salary_profile' });
    expect(resolveHourlyRate({ shift, workplaceHourlyRateMinor: 4500 })).toMatchObject({ rateMinor: 4500, source: 'workplace' });
  });
  it('uses a completed positive snapshot for historical reproducibility', () => expect(resolveHourlyRate({ shift: createShift({ status: 'completed', actualStart: '2026-07-15T13:30:00+03:00', actualEnd: '2026-07-15T22:00:00+03:00', hourlyRateSnapshotMinor: 5800 }), profile })).toMatchObject({ rateMinor: 5800, source: 'shift_snapshot' }));
  it('returns an explicit missing-rate issue instead of zero pay', () => expect(resolveHourlyRate({ shift: createShift({ hourlyRateSnapshotMinor: 0 }) })).toMatchObject({ rateMinor: undefined, issue: expect.objectContaining({ code: 'missing_hourly_rate' }) }));
});
