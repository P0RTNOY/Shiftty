import { payRuleSchema, salaryProfileSchema, shiftSchema, type BreakSession, type PayRule, type SalaryProfile, type Shift } from '@/domain/entities';

export function createShift(overrides: Partial<Shift> = {}): Shift {
  const candidate = {
    id: 'shift-1',
    workplaceId: 'workplace-1',
    scheduledStart: '2026-07-15T13:30:00+03:00',
    scheduledEnd: '2026-07-15T22:00:00+03:00',
    expectedBreakMinutes: 30,
    status: 'scheduled',
    hourlyRateSnapshotMinor: 4_500,
    timezone: 'Asia/Jerusalem',
    createdAt: '2026-07-01T10:00:00+03:00',
    updatedAt: '2026-07-01T10:00:00+03:00',
    ...overrides,
  };
  if (candidate.status === 'completed') {
    candidate.payableStart ??= candidate.actualStart;
    candidate.payableEnd ??= candidate.actualEnd;
    candidate.payableSource ??= 'actual';
    candidate.completedAt ??= candidate.actualEnd ?? candidate.updatedAt;
  }
  if (candidate.status === 'active') candidate.activeOrigin ??= candidate.scheduledStart ? 'scheduled' : 'unscheduled';
  return shiftSchema.parse(candidate);
}

export function createSalaryProfile(overrides: Partial<SalaryProfile> = {}): SalaryProfile {
  return salaryProfileSchema.parse({
    id: 'profile-1', workplaceId: 'workplace-1', name: 'Default', currency: 'ILS', timezone: 'Asia/Jerusalem',
    baseHourlyRateMinor: 4500, defaultTravelReimbursementMinor: 0, defaultShiftBonusMinor: 0,
    calculationRoundingMode: 'half_up', breakPolicy: 'perBreak', isActive: true, isArchived: false,
    createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00', ...overrides,
  });
}

export function createPayRule(overrides: Partial<PayRule> = {}): PayRule {
  return payRuleSchema.parse({
    id: 'rule-1', salaryProfileId: 'profile-1', name: 'Rule', priority: 0, conditions: [],
    effect: { type: 'multiplier', basisPoints: 10000 }, canStack: false, isEnabled: true,
    createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00', ...overrides,
  });
}

export function createBreak(overrides: Partial<BreakSession> = {}): BreakSession {
  return {
    id: 'break-1',
    shiftId: 'shift-1',
    start: '2026-07-15T17:00:00+03:00',
    end: '2026-07-15T17:30:00+03:00',
    isPaid: false,
    source: 'tracked',
    createdAt: '2026-07-15T17:00:00+03:00',
    updatedAt: '2026-07-15T17:30:00+03:00',
    ...overrides,
  };
}
