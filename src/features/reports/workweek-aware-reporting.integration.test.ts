import type { SalaryCalculationSnapshot, SalaryProfile, Shift, Workplace } from '@/domain/entities';
import { calculateSalary } from '@/domain/services';
import { generateIcs } from '@/domain/services/ics-generator';
import {
  SalaryCalculationCoordinator,
  type SalaryCoordinatorRepositories,
} from '@/features/pay-rules/services/salary-calculation-coordinator';
import { generateMonthlyReportCsv, generateMonthlyReportPdfHtml } from '@/features/reports/monthly-report-export';
import { buildMonthlyReport } from '@/features/reports/monthly-report-service';
import { createSalaryProfile, createShift } from '@/test/fixtures';

const CALCULATED_AT = '2026-08-01T12:30:00+03:00';
const WORKWEEK_START = '2026-07-26';

function weeklyProfile(overrides: Partial<SalaryProfile> = {}): SalaryProfile {
  return createSalaryProfile({
    id: 'profile-weekly',
    workplaceId: 'workplace-1',
    baseHourlyRateMinor: 6_000,
    timezone: 'Asia/Jerusalem',
    workweekStartWeekday: 0,
    weeklyOvertimeEnabled: true,
    weeklyRegularMinutes: 42 * 60,
    weeklyOvertimeMultiplierBasisPoints: 12_500,
    weeklyOvertimeBasis: 'net',
    ...overrides,
  });
}

function completedShift(id: string, start: string, end: string, overrides: Partial<Shift> = {}): Shift {
  return createShift({
    id,
    salaryProfileId: 'profile-weekly',
    status: 'completed',
    actualStart: start,
    actualEnd: end,
    payableStart: start,
    payableEnd: end,
    actualBreakMinutes: 0,
    payableBreakMinutes: 0,
    payableSource: 'actual',
    completedAt: end,
    hourlyRateSnapshotMinor: 0,
    ...overrides,
  });
}

function priorFortyOneHours(overrides: Partial<Shift> = {}): Shift[] {
  return [
    completedShift('context-sun', '2026-07-26T08:00:00+03:00', '2026-07-26T16:00:00+03:00', overrides),
    completedShift('context-mon', '2026-07-27T08:00:00+03:00', '2026-07-27T16:00:00+03:00', overrides),
    completedShift('context-tue', '2026-07-28T08:00:00+03:00', '2026-07-28T16:00:00+03:00', overrides),
    completedShift('context-wed', '2026-07-29T08:00:00+03:00', '2026-07-29T16:00:00+03:00', overrides),
    completedShift('context-thu', '2026-07-30T08:00:00+03:00', '2026-07-30T16:00:00+03:00', overrides),
    completedShift('context-fri', '2026-07-31T08:00:00+03:00', '2026-07-31T09:00:00+03:00', overrides),
  ];
}

function targetShift(overrides: Partial<Shift> = {}): Shift {
  return completedShift('august-target', '2026-08-01T10:00:00+03:00', '2026-08-01T12:00:00+03:00', overrides);
}

function workplace(id: string, salaryProfileId: string): Workplace {
  return {
    id,
    name: id === 'workplace-1' ? 'Cafe' : 'Other',
    defaultHourlyRateMinor: 0,
    defaultBreakMinutes: 0,
    salaryProfileId,
    createdAt: '2026-01-01T00:00:00+02:00',
    updatedAt: '2026-01-01T00:00:00+02:00',
  };
}

function coordinatorRepositories(input: {
  candidates: readonly Shift[];
  profiles?: readonly SalaryProfile[];
  workplaces?: readonly Workplace[];
}): SalaryCoordinatorRepositories {
  const profiles = input.profiles ?? [weeklyProfile()];
  const workplaces = input.workplaces ?? [workplace('workplace-1', 'profile-weekly')];
  return {
    shifts: { list: jest.fn().mockResolvedValue([...input.candidates]) } as unknown as SalaryCoordinatorRepositories['shifts'],
    activeShifts: {
      listBreaks: jest.fn().mockResolvedValue([]),
      listBreaksForShifts: jest.fn().mockResolvedValue([]),
    } as unknown as SalaryCoordinatorRepositories['activeShifts'],
    workplaces: {
      list: jest.fn().mockResolvedValue(workplaces),
      listRoles: jest.fn().mockResolvedValue([]),
    } as unknown as SalaryCoordinatorRepositories['workplaces'],
    salaryProfiles: {
      listByWorkplace: jest.fn((workplaceId: string) => Promise.resolve(profiles.filter((profile) => profile.workplaceId === workplaceId))),
      getById: jest.fn((id: string) => Promise.resolve(profiles.find((profile) => profile.id === id) ?? null)),
    } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
    payRules: { listForProfile: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['payRules'],
    salaryCalculations: {
      listCurrentForShifts: jest.fn().mockResolvedValue([]),
      listHistory: jest.fn().mockResolvedValue([]),
      saveSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
  };
}

function weeklyTargetResult() {
  return calculateSalary({
    shift: targetShift(),
    profile: weeklyProfile(),
    rules: [],
    breaks: [],
    holidayIntervals: [],
    priorWorkedMinutesByWorkweek: { [WORKWEEK_START]: 41 * 60 },
    priorGrossMinutesByWorkweek: { [WORKWEEK_START]: 41 * 60 },
    calculatedAt: CALCULATED_AT,
  });
}

function snapshot(shiftId: string, result: ReturnType<typeof calculateSalary>, totalGrossPayMinor = result.totalGrossPayMinor): SalaryCalculationSnapshot {
  return {
    id: `snapshot-${shiftId}`,
    shiftId,
    version: 1,
    status: 'finalized',
    salaryProfileId: 'profile-weekly',
    result: { ...result, totalGrossPayMinor },
    isCurrent: true,
    createdAt: CALCULATED_AT,
  };
}

describe('workweek-aware reporting integration', () => {
  it('auto-loads prior same-workweek shifts across the month boundary without returning or aggregating context-only shifts', async () => {
    const contextShifts = priorFortyOneHours();
    const repositories = coordinatorRepositories({ candidates: contextShifts });

    const result = await new SalaryCalculationCoordinator(repositories).calculateMany(
      [targetShift()],
      CALCULATED_AT,
      undefined,
      { reportingRange: { start: '2026-08-01T00:00:00+03:00', end: '2026-09-01T00:00:00+03:00' } },
    );

    expect(repositories.shifts.list).toHaveBeenCalledWith({
      endsAfter: '2026-07-26T00:00:00.000+03:00',
      startsBefore: '2026-08-01T12:00:00+03:00',
      statuses: ['completed'],
      workplaceId: 'workplace-1',
      rangeSource: 'salary',
    });
    expect(Object.keys(result.resultsByShiftId)).toEqual(['august-target']);
    expect(result.resultsByShiftId['august-target']).toMatchObject({
      regularMinutes: 60,
      specialRateMinutes: 60,
      basePayMinor: 12_000,
      premiumPayMinor: 1_500,
      totalGrossPayMinor: 13_500,
    });
    expect(result).toMatchObject({
      earnedMinor: 13_500,
      futureMinor: 0,
      forecastMinor: 13_500,
      regularMinutes: 60,
      specialRateMinutes: 60,
      basePayMinor: 12_000,
      premiumPayMinor: 1_500,
      bonusesMinor: 0,
      reimbursementsMinor: 0,
      byWorkplace: { 'workplace-1': { minutes: 120, totalMinor: 13_500 } },
      byDate: { '2026-08-01': { minutes: 120, totalMinor: 13_500 } },
    });
    expect(result.resultsByShiftId['august-target']?.segments).toEqual([
      expect.objectContaining({ minutes: 60, multiplierBasisPoints: 10_000, appliedRuleIds: [] }),
      expect.objectContaining({ minutes: 60, multiplierBasisPoints: 12_500, appliedRuleIds: ['system-weekly-overtime:profile-weekly'] }),
    ]);
  });

  it.each([
    ['workplace', weeklyProfile({ id: 'profile-other', workplaceId: 'workplace-2' }), { workplaceId: 'workplace-2', salaryProfileId: 'profile-other' }],
    ['profile', weeklyProfile({ id: 'profile-other' }), { salaryProfileId: 'profile-other' }],
    ['profile timezone', weeklyProfile({ id: 'profile-other', timezone: 'America/New_York' }), { salaryProfileId: 'profile-other', timezone: 'America/New_York' }],
  ] as const)('does not accumulate context from an incompatible %s', async (_label, incompatibleProfile, shiftOverrides) => {
    const configured = weeklyProfile();
    const otherWorkplace = workplace('workplace-2', 'profile-other');
    const repositories = coordinatorRepositories({
      candidates: priorFortyOneHours(shiftOverrides),
      profiles: [configured, incompatibleProfile],
      workplaces: [workplace('workplace-1', 'profile-weekly'), otherWorkplace],
    });

    const result = await new SalaryCalculationCoordinator(repositories).calculateMany([targetShift()], CALCULATED_AT);

    expect(result.resultsByShiftId['august-target']).toMatchObject({
      regularMinutes: 120,
      specialRateMinutes: 0,
      basePayMinor: 12_000,
      premiumPayMinor: 0,
      totalGrossPayMinor: 12_000,
    });
    expect(result.earnedMinor).toBe(12_000);
  });

  it('keeps selected-month rows and finalized-zero, stale, and missing semantics while using the weekly-finalized snapshot total', () => {
    const result = weeklyTargetResult();
    const target = targetShift({ salaryCalculationStatus: 'finalized' });
    const julyContext = completedShift('july-context', '2026-07-31T08:00:00+03:00', '2026-07-31T09:00:00+03:00', { salaryCalculationStatus: 'finalized' });
    const zero = completedShift('august-zero', '2026-08-02T08:00:00+03:00', '2026-08-02T09:00:00+03:00', { salaryCalculationStatus: 'finalized' });
    const stale = completedShift('august-stale', '2026-08-03T08:00:00+03:00', '2026-08-03T09:00:00+03:00', { salaryCalculationStatus: 'stale' });
    const missing = completedShift('august-missing', '2026-08-04T08:00:00+03:00', '2026-08-04T09:00:00+03:00', { salaryCalculationStatus: 'finalized' });
    const oneHourResult = calculateSalary({ shift: zero, profile: weeklyProfile(), rules: [], breaks: [], holidayIntervals: [], calculatedAt: CALCULATED_AT });

    const report = buildMonthlyReport({
      month: '2026-08',
      timezone: 'Asia/Jerusalem',
      generatedAt: CALCULATED_AT,
      shifts: [julyContext, target, zero, stale, missing],
      snapshots: [
        snapshot(julyContext.id, oneHourResult, 6_000),
        snapshot(target.id, result),
        snapshot(zero.id, oneHourResult, 0),
        snapshot(stale.id, oneHourResult, 6_000),
      ],
      workplaces: [{ id: 'workplace-1', name: 'Cafe' }],
      roles: [],
    });

    expect(report.rows.map((row) => row.shiftId)).toEqual(['august-target', 'august-zero', 'august-stale', 'august-missing']);
    expect(Object.fromEntries(report.rows.map((row) => [row.shiftId, [row.salaryStatus, row.salaryMinor]]))).toEqual({
      'august-target': ['available', 13_500],
      'august-zero': ['available', 0],
      'august-stale': ['stale', undefined],
      'august-missing': ['missing', undefined],
    });
    expect(report.totals).toMatchObject({
      shiftCount: 4,
      availableSalaryMinor: 13_500,
      salaryMinor: undefined,
      salaryIssueCount: 2,
    });
  });

  it('renders the exact weekly-finalized total consistently in CSV and PDF', () => {
    const result = weeklyTargetResult();
    const target = targetShift({ salaryCalculationStatus: 'finalized' });
    const report = buildMonthlyReport({
      month: '2026-08',
      timezone: 'Asia/Jerusalem',
      generatedAt: CALCULATED_AT,
      shifts: [target],
      snapshots: [snapshot(target.id, result)],
      workplaces: [{ id: 'workplace-1', name: 'Cafe' }],
      roles: [],
    });

    const csv = generateMonthlyReportCsv(report, 'en');
    const html = generateMonthlyReportPdfHtml(report, 'en');
    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(135);

    expect(report.totals.salaryMinor).toBe(13_500);
    expect(csv.split('\r\n')[1]?.split(',')[9]).toBe('135.00');
    expect(html).toContain(formattedTotal);
    expect(html).not.toContain('$120.00');
  });

  it('keeps ICS strictly finance-free for a shift whose finalized weekly estimate is present on the legacy shift summary field', () => {
    const shift = targetShift({
      title: 'Weekly threshold shift',
      salaryCalculationStatus: 'finalized',
      payableGrossPayMinor: 13_500,
    });

    const ics = generateIcs([shift], { fallbackTitle: 'Shift' });

    expect(ics).toContain('SUMMARY:Weekly threshold shift');
    expect(ics).not.toContain('135.00');
    expect(ics).not.toContain('13\,500');
    expect(ics).not.toContain('salary');
    expect(ics).not.toContain('pay');
    expect(ics).not.toContain('₪');
  });
});
