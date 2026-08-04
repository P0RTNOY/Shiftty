import type { PayCalculationIssue, SalaryProfile, Shift } from '@/domain/entities';

export type HourlyRateSource = 'shift_override' | 'shift_snapshot' | 'date_override' | 'role_override' | 'salary_profile' | 'workplace';

export interface HourlyRateResolution {
  rateMinor?: number;
  source?: HourlyRateSource;
  issue?: PayCalculationIssue;
}

export interface ResolveHourlyRateInput {
  shift: Shift;
  profile?: SalaryProfile;
  dateOverrideMinor?: number;
  roleHourlyRateMinor?: number;
  workplaceHourlyRateMinor?: number;
  ignoreHistoricalSnapshot?: boolean;
}

export function resolveHourlyRate(input: ResolveHourlyRateInput): HourlyRateResolution {
  const candidates: [HourlyRateSource, number | undefined][] = [
    ['shift_override', input.shift.hourlyRateOverrideMinor],
    ['shift_snapshot', input.shift.status === 'completed' && !input.ignoreHistoricalSnapshot ? input.shift.hourlyRateSnapshotMinor : undefined],
    ['date_override', input.dateOverrideMinor],
    ['role_override', input.roleHourlyRateMinor],
    ['salary_profile', input.profile?.baseHourlyRateMinor],
    ['workplace', input.workplaceHourlyRateMinor],
  ];

  const resolved = candidates.find(([, value]) => value !== undefined && value > 0);
  if (resolved) return { source: resolved[0], rateMinor: resolved[1] };

  return {
    rateMinor: undefined,
    issue: {
      code: 'missing_hourly_rate',
      severity: 'error',
      messageKey: 'salary.issues.missingHourlyRate',
      metadata: { shiftId: input.shift.id, workplaceId: input.shift.workplaceId },
    },
  };
}
