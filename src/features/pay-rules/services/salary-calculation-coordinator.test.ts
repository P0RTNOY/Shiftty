import { SalaryCalculationCoordinator, type SalaryCoordinatorRepositories } from '@/features/pay-rules/services/salary-calculation-coordinator';
import { calculateSalary } from '@/domain/services';
import { StaticHolidayProvider } from '@/domain/services/holiday-provider';
import { createCalendarEvidenceInterval, createPayRule, createSalaryProfile, createShift, createWeeklyRestSchedule } from '@/test/fixtures';

function repositories(overrides: Partial<SalaryCoordinatorRepositories> = {}): SalaryCoordinatorRepositories {
  const workplace = { id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 0, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' };
  return {
    shifts: { list: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['shifts'],
    activeShifts: { listBreaks: jest.fn().mockResolvedValue([]), listBreaksForShifts: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['activeShifts'],
    workplaces: { list: jest.fn().mockResolvedValue([workplace]), listRoles: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['workplaces'],
    salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([]), getById: jest.fn().mockResolvedValue(null) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
    payRules: { listForProfile: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['payRules'],
    salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([]), listHistory: jest.fn().mockResolvedValue([]), saveSnapshot: jest.fn().mockResolvedValue(undefined) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    ...overrides,
  };
}

describe('SalaryCalculationCoordinator', () => {
  it('uses the finalized snapshot after later profile rate changes', async () => {
    const completed = createShift({ status: 'completed', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 5000, salaryCalculationStatus: 'finalized' });
    const oldProfile = createSalaryProfile({ baseHourlyRateMinor: 5000 }); const newerProfile = createSalaryProfile({ baseHourlyRateMinor: 10000 });
    const oldResult = calculateSalary({ shift: completed, profile: oldProfile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: completed.completedAt! });
    const snapshot = { id: 'snapshot', shiftId: completed.id, version: 1, status: 'finalized' as const, salaryProfileId: oldProfile.id, result: oldResult, isCurrent: true, createdAt: completed.completedAt! };
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([newerProfile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'], salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([snapshot]) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'] });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([completed], '2026-08-01T00:00:00+03:00');
    expect(summary.earnedMinor).toBe(10000);
    expect(deps.activeShifts.listBreaks).not.toHaveBeenCalled();
  });

  it('persists an incomplete version instead of a false zero total when rate setup is missing', async () => {
    const shift = createShift({ status: 'completed', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 0 });
    const saveSnapshot = jest.fn().mockResolvedValue(undefined); const deps = repositories({ salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([]), listHistory: jest.fn().mockResolvedValue([{ version: 2 }]), saveSnapshot } as unknown as SalaryCoordinatorRepositories['salaryCalculations'] });
    const snapshot = await new SalaryCalculationCoordinator(deps).finalizeCompletedShift(shift, shift.completedAt!);
    expect(snapshot).toMatchObject({ version: 3, status: 'incomplete', result: { totalGrossPayMinor: undefined } });
    expect(saveSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it('keeps a current incomplete snapshot authoritative for a completed shift', async () => {
    const completed = createShift({
      status: 'completed',
      actualStart: '2026-07-15T08:00:00+03:00',
      actualEnd: '2026-07-15T10:00:00+03:00',
      payableStart: '2026-07-15T08:00:00+03:00',
      payableEnd: '2026-07-15T10:00:00+03:00',
      payableBreakMinutes: 0,
      payableSource: 'actual',
      completedAt: '2026-07-15T10:00:00+03:00',
      hourlyRateSnapshotMinor: 6000,
      salaryCalculationStatus: 'incomplete',
    });
    const incompleteResult = calculateSalary({
      shift: { ...completed, hourlyRateSnapshotMinor: 0 },
      rules: [],
      breaks: [],
      holidayIntervals: [],
      calculatedAt: completed.completedAt!,
    });
    const snapshot = {
      id: 'incomplete-snapshot',
      shiftId: completed.id,
      version: 1,
      status: 'incomplete' as const,
      result: incompleteResult,
      isCurrent: true,
      createdAt: completed.completedAt!,
    };
    const deps = repositories({
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([snapshot]) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });

    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([completed], '2026-08-01T00:00:00+03:00');

    expect(summary.resultsByShiftId[completed.id]?.totalGrossPayMinor).toBeUndefined();
    expect(summary).toMatchObject({ earnedMinor: 0, incompleteShiftCount: 1 });
  });

  it('does not surface a numeric total for an incomplete completed shift when its snapshot is unavailable', async () => {
    const completed = createShift({
      status: 'completed',
      actualStart: '2026-07-15T08:00:00+03:00',
      actualEnd: '2026-07-15T10:00:00+03:00',
      payableStart: '2026-07-15T08:00:00+03:00',
      payableEnd: '2026-07-15T10:00:00+03:00',
      payableBreakMinutes: 0,
      payableSource: 'actual',
      completedAt: '2026-07-15T10:00:00+03:00',
      hourlyRateSnapshotMinor: 6000,
      salaryCalculationStatus: 'incomplete',
    });

    const summary = await new SalaryCalculationCoordinator(repositories()).calculateMany([completed], '2026-08-01T00:00:00+03:00');

    expect(summary.resultsByShiftId[completed.id]?.totalGrossPayMinor).toBeUndefined();
    expect(summary).toMatchObject({ earnedMinor: 0, incompleteShiftCount: 1 });
  });

  it('includes earlier completed shifts when finalizing a daily threshold', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const first = createShift({ id: 'first', status: 'completed', scheduledStart: '2026-07-14T08:00:00+03:00', scheduledEnd: '2026-07-14T11:00:00+03:00', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T11:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T11:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T11:00:00+03:00', hourlyRateSnapshotMinor: 6000, salaryCalculationStatus: 'finalized' });
    const second = createShift({ id: 'second', status: 'completed', actualStart: '2026-07-15T12:00:00+03:00', actualEnd: '2026-07-15T14:00:00+03:00', payableStart: '2026-07-15T12:00:00+03:00', payableEnd: '2026-07-15T14:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T14:00:00+03:00', hourlyRateSnapshotMinor: 6000 });
    const threshold = createPayRule({ id: 'daily', conditions: [{ type: 'workedMinutes', afterMinutes: 240, scope: 'day' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const firstResult = calculateSalary({ shift: first, profile, rules: [threshold], breaks: [], holidayIntervals: [], calculatedAt: first.completedAt! });
    const firstSnapshot = { id: 'first-snapshot', shiftId: first.id, version: 1, status: 'finalized' as const, salaryProfileId: profile.id, result: firstResult, isCurrent: true, createdAt: first.completedAt! };
    const saveSnapshot = jest.fn().mockResolvedValue(undefined);
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([first, second]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([threshold]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([firstSnapshot]), listHistory: jest.fn().mockResolvedValue([]), saveSnapshot } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });
    const snapshot = await new SalaryCalculationCoordinator(deps).finalizeCompletedShift(second, second.completedAt!);
    expect(snapshot.result.segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[60, 10000], [60, 12500]]);
    expect(deps.shifts.list).toHaveBeenCalledWith(expect.objectContaining({ rangeSource: 'salary' }));
  });

  it('explicit recalculation uses the current profile instead of the old shift rate snapshot', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 10000 });
    const shift = createShift({ status: 'completed', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 5000, salaryCalculationStatus: 'finalized' });
    const saveSnapshot = jest.fn().mockResolvedValue(undefined); const deps = repositories({ shifts: { list: jest.fn().mockResolvedValue([shift]) } as unknown as SalaryCoordinatorRepositories['shifts'], salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'], salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([]), listHistory: jest.fn().mockResolvedValue([]), saveSnapshot } as unknown as SalaryCoordinatorRepositories['salaryCalculations'] });
    const snapshot = await new SalaryCalculationCoordinator(deps).finalizeCompletedShift(shift, '2026-08-01T00:00:00+03:00', true);
    expect(snapshot.result).toMatchObject({ resolvedBaseHourlyRateMinor: 10000, totalGrossPayMinor: 20000 });
  });

  it('explicit recalculation ignores the current frozen snapshot after payable time changes', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 5000 });
    const original = createShift({ status: 'completed', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 5000, salaryCalculationStatus: 'finalized' });
    const oldResult = calculateSalary({ shift: original, profile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: original.completedAt! });
    const oldSnapshot = { id: 'old-snapshot', shiftId: original.id, version: 1, status: 'finalized' as const, salaryProfileId: profile.id, result: oldResult, isCurrent: true, createdAt: original.completedAt! };
    const edited = { ...original, actualEnd: '2026-07-15T11:00:00+03:00', payableEnd: '2026-07-15T11:00:00+03:00', salaryCalculationStatus: 'stale' as const };
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([edited]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([oldSnapshot]), listHistory: jest.fn().mockResolvedValue([oldSnapshot]), saveSnapshot: jest.fn().mockResolvedValue(undefined) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });

    const snapshot = await new SalaryCalculationCoordinator(deps).finalizeCompletedShift(edited, '2026-08-01T00:00:00+03:00', true);

    expect(snapshot.result).toMatchObject({ payableMinutes: 180, totalGrossPayMinor: 15000 });
  });

  it('resolves a role override before freezing a newly completed shift placeholder rate', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 5000 });
    const shift = createShift({ status: 'completed', roleId: 'role-1', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 5000, salaryCalculationStatus: 'not_calculated' });
    const saveSnapshot = jest.fn().mockResolvedValue(undefined);
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([shift]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      workplaces: { list: jest.fn().mockResolvedValue([{ id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 5000, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]), listRoles: jest.fn().mockResolvedValue([{ id: 'role-1', workplaceId: 'workplace-1', name: 'Lead', hourlyRateMinor: 6000, isArchived: false, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]) } as unknown as SalaryCoordinatorRepositories['workplaces'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([]), listHistory: jest.fn().mockResolvedValue([]), saveSnapshot } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });
    const snapshot = await new SalaryCalculationCoordinator(deps).finalizeCompletedShift(shift, shift.completedAt!);
    expect(snapshot.result).toMatchObject({ resolvedBaseHourlyRateMinor: 6000, totalGrossPayMinor: 12000 });
  });

  it('preserves stale finalized snapshots and exposes their stale status', async () => {
    const shift = createShift({ status: 'completed', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T10:00:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T10:00:00+03:00', payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T10:00:00+03:00', hourlyRateSnapshotMinor: 5000, salaryCalculationStatus: 'stale' });
    const oldResult = calculateSalary({ shift, profile: createSalaryProfile({ baseHourlyRateMinor: 5000 }), rules: [], breaks: [], holidayIntervals: [], calculatedAt: shift.completedAt! });
    const snapshot = { id: 'stale-snapshot', shiftId: shift.id, version: 1, status: 'finalized' as const, result: oldResult, isCurrent: true, createdAt: shift.completedAt! };
    const deps = repositories({ salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([snapshot]) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'] });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([shift], '2026-08-01T00:00:00+03:00');
    expect(summary).toMatchObject({ earnedMinor: 10000, staleShiftCount: 1 });
  });

  it('applies workplace bonus and travel defaults when no profile exists', async () => {
    const shift = createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const deps = repositories({ workplaces: { list: jest.fn().mockResolvedValue([{ id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 6000, defaultBreakMinutes: 0, defaultShiftBonusMinor: 300, defaultTravelReimbursementMinor: 500, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]), listRoles: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['workplaces'] });
    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-07-15T08:00:00+03:00');
    expect(result).toMatchObject({ fixedBonusesMinor: 300, reimbursementsMinor: 500, totalGrossPayMinor: 52550 });
  });

  it('applies and explains the default overtime policy when no custom overtime rule exists', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'] });

    const result = await new SalaryCalculationCoordinator(deps).previewShift(createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 }), '2026-08-10T12:00:00+03:00');

    expect(result).toMatchObject({ regularMinutes: 480, specialRateMinutes: 30, totalGrossPayMinor: 51750 });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'default_overtime_applied', severity: 'warning' }));
  });

  it('injects offline holiday intervals into normal orchestration', async () => {
    const shift = createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const rule = createPayRule({ id: 'holiday', conditions: [{ type: 'holiday' }], effect: { type: 'multiplier', basisPoints: 15000 } });
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'], payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'] });
    const provider = new StaticHolidayProvider([{ id: 'holiday-1', name: 'Holiday', start: shift.scheduledStart!, end: shift.scheduledEnd! }]);
    const result = await new SalaryCalculationCoordinator(deps, provider).previewShift(shift, '2026-07-15T08:00:00+03:00');
    expect(result.specialRateMinutes).toBe(510);
  });

  it('loads bounded evidence for the resolved workplace and profile in deterministic order', async () => {
    const shift = createShift({
      scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T12:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
    });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const holiday = createCalendarEvidenceInterval({
      id: 'holiday', start: '2026-07-15T09:00:00+03:00', end: '2026-07-15T11:00:00+03:00',
    });
    const custom = createCalendarEvidenceInterval({
      id: 'custom', type: 'custom', name: 'Confirmed custom interval',
      start: '2026-07-15T10:00:00+03:00', end: '2026-07-15T10:30:00+03:00',
    });
    const foreignProfile = createCalendarEvidenceInterval({
      id: 'foreign-profile', salaryProfileId: 'other-profile',
      start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T12:00:00+03:00',
    });
    const archived = createCalendarEvidenceInterval({
      id: 'archived', isArchived: true, archivedAt: '2026-07-10T00:00:00+03:00',
      start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T12:00:00+03:00',
    });
    const rule = createPayRule({
      id: 'configured-holiday', premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'multiplier', basisPoints: 15000 },
    });
    const listOverlapping = jest.fn().mockResolvedValue([custom, archived, foreignProfile, holiday]);
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-07-15T12:00:00+03:00');

    expect(listOverlapping).toHaveBeenCalledWith({
      workplaceId: shift.workplaceId,
      salaryProfileId: profile.id,
      start: shift.scheduledStart,
      end: shift.scheduledEnd,
    });
    expect(result.totalGrossPayMinor).toBe(30000);
    expect(result.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([
      [60, 10000], [60, 15000], [30, 15000], [30, 15000], [60, 10000],
    ]);
    expect(result.specialIntervalEvaluations?.map((item) => [item.intervalId, item.contributedToEstimate])).toEqual([
      ['holiday', true], ['custom', false],
    ]);
  });

  it('batches evidence reads without leaking an interval into a non-overlapping shift', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const morning = createShift({
      id: 'morning', scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T10:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
    });
    const evening = createShift({
      id: 'evening', scheduledStart: '2026-07-15T18:00:00+03:00', scheduledEnd: '2026-07-15T20:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
    });
    const morningHoliday = createCalendarEvidenceInterval({
      id: 'morning-holiday', start: morning.scheduledStart!, end: morning.scheduledEnd!,
    });
    const specialRule = createPayRule({
      id: 'holiday-rate', premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'multiplier', basisPoints: 15000 },
    });
    const listOverlapping = jest.fn().mockResolvedValue([morningHoliday]);
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([specialRule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).calculateMany([morning, evening], '2026-07-15T21:00:00+03:00');

    expect(listOverlapping).toHaveBeenCalledTimes(1);
    expect(result.resultsByShiftId[morning.id]?.specialIntervalEvaluations).toEqual([
      expect.objectContaining({ intervalId: morningHoliday.id, contributedToEstimate: true }),
    ]);
    expect(result.resultsByShiftId[evening.id]?.specialIntervalEvaluations).toBeUndefined();
    expect(result.resultsByShiftId[morning.id]?.totalGrossPayMinor).toBe(18000);
    expect(result.resultsByShiftId[evening.id]?.totalGrossPayMinor).toBe(12000);
  });

  it('resolves a confirmed recurring weekly-rest occurrence without materializing a shift', async () => {
    const shift = createShift({
      scheduledStart: '2026-07-17T08:00:00+03:00', scheduledEnd: '2026-07-17T12:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
    });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5, startTime: '09:00', endWeekday: 5, endTime: '11:00', enabled: true,
      confirmedAt: '2026-07-01T10:00:00+03:00',
    });
    const rule = createPayRule({
      id: 'weekly-rest-rate', premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 15000 },
    });
    const getForProfile = jest.fn().mockResolvedValue(schedule);
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping: jest.fn().mockResolvedValue([]) } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
      weeklyRestSchedules: { getForProfile } as unknown as NonNullable<SalaryCoordinatorRepositories['weeklyRestSchedules']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-07-17T12:00:00+03:00');

    expect(getForProfile).toHaveBeenCalledWith(profile.id);
    expect(result.totalGrossPayMinor).toBe(30000);
    expect(result.specialIntervalEvaluations).toEqual([
      expect.objectContaining({ type: 'weekly_rest', name: schedule.label, contributedToEstimate: true }),
    ]);
  });

  it('combines a profile-specific Friday-to-Sunday rest rate with overnight overtime tiers', async () => {
    const shift = createShift({
      scheduledStart: '2026-08-29T17:30:00+03:00',
      scheduledEnd: '2026-08-30T05:30:00+03:00',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 0,
    });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5,
      startTime: '18:00',
      endWeekday: 0,
      endTime: '18:00',
      enabled: true,
      confirmedAt: '2026-08-28T17:00:00+03:00',
    });
    const rule = createPayRule({
      id: 'weekly-rest-rate',
      premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 15_000 },
    });
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping: jest.fn().mockResolvedValue([]) } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
      weeklyRestSchedules: { getForProfile: jest.fn().mockResolvedValue(schedule) } as unknown as NonNullable<SalaryCoordinatorRepositories['weeklyRestSchedules']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-08-29T17:00:00+03:00');

    expect(result.segments.map((segment) => [segment.localDate, segment.minutes, segment.multiplierBasisPoints])).toEqual([
      ['2026-08-29', 390, 15_000],
      ['2026-08-30', 90, 15_000],
      ['2026-08-30', 120, 17_500],
      ['2026-08-30', 120, 20_000],
    ]);
    expect(result).toMatchObject({
      payableMinutes: 720,
      regularMinutes: 0,
      specialRateMinutes: 720,
      basePayMinor: 72_000,
      premiumPayMinor: 45_000,
      totalGrossPayMinor: 117_000,
    });
    expect(result.specialIntervalEvaluations).toEqual([
      expect.objectContaining({ type: 'weekly_rest', contributedToEstimate: true }),
    ]);
  });

  it('recalculates the real 12-hour-1-minute completed weekly-rest shift without truncating pay', async () => {
    const shift = createShift({
      id: 'real-weekly-rest-shift',
      status: 'completed',
      actualStart: '2026-08-29T17:23:00+03:00',
      actualEnd: '2026-08-30T05:24:00+03:00',
      payableStart: '2026-08-29T17:23:00+03:00',
      payableEnd: '2026-08-30T05:24:00+03:00',
      payableBreakMinutes: 0,
      payableSource: 'actual',
      completedAt: '2026-08-30T05:24:00+03:00',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 6000,
      salaryCalculationStatus: 'incomplete',
    });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5,
      startTime: '18:00',
      endWeekday: 0,
      endTime: '18:00',
      enabled: true,
      confirmedAt: '2026-08-28T17:00:00+03:00',
    });
    const rule = createPayRule({
      id: 'weekly-rest-rate',
      premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 15_000 },
    });
    const currentResult = calculateSalary({
      shift,
      profile,
      rules: [rule],
      breaks: [],
      holidayIntervals: [],
      specialIntervals: [],
      calculatedAt: shift.completedAt!,
      ignoreHistoricalSnapshot: true,
    });
    const legacyResult = {
      ...currentResult,
      engineVersion: '1.5.0',
      totalGrossPayMinor: undefined,
      issues: currentResult.issues.map((issue) => issue.code === 'shift_duration_exceeds_maximum'
        ? { ...issue, severity: 'error' as const }
        : issue),
    };
    const legacySnapshotV1 = {
      id: 'legacy-over-limit-snapshot-v1',
      shiftId: shift.id,
      version: 1,
      status: 'incomplete' as const,
      salaryProfileId: profile.id,
      result: legacyResult,
      isCurrent: false,
      createdAt: shift.completedAt!,
    };
    const legacySnapshot = {
      ...legacySnapshotV1,
      id: 'legacy-over-limit-snapshot-v2',
      version: 2,
      result: { ...legacyResult, calculatedAt: '2026-08-30T07:04:44+03:00' },
      isCurrent: true,
      createdAt: '2026-08-30T07:04:44+03:00',
    };
    const legacyV1Json = JSON.stringify(legacySnapshotV1.result);
    const legacyV2Json = JSON.stringify(legacySnapshot.result);
    const saveSnapshot = jest.fn().mockResolvedValue(undefined);
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([shift]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: {
        listByWorkplace: jest.fn().mockResolvedValue([profile]),
        getById: jest.fn().mockResolvedValue(profile),
      } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping: jest.fn().mockResolvedValue([]) } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
      weeklyRestSchedules: { getForProfile: jest.fn().mockResolvedValue(schedule) } as unknown as NonNullable<SalaryCoordinatorRepositories['weeklyRestSchedules']>,
      salaryCalculations: {
        listCurrentForShifts: jest.fn().mockResolvedValue([legacySnapshot]),
        listHistory: jest.fn().mockResolvedValue([legacySnapshotV1, legacySnapshot]),
        saveSnapshot,
      } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });
    const coordinator = new SalaryCalculationCoordinator(deps);

    const preview = await coordinator.previewShift(shift, '2026-08-30T10:00:00+03:00', undefined, true);
    const finalized = await coordinator.finalizeCompletedShift(shift, '2026-08-30T10:00:00+03:00', true);

    expect(preview.segments.map((segment) => [segment.localDate, segment.minutes, segment.multiplierBasisPoints])).toEqual([
      ['2026-08-29', 397, 15_000],
      ['2026-08-30', 83, 15_000],
      ['2026-08-30', 120, 17_500],
      ['2026-08-30', 121, 20_000],
    ]);
    expect(preview).toMatchObject({
      payableMinutes: 721,
      basePayMinor: 72_100,
      premiumPayMinor: 45_100,
      totalGrossPayMinor: 117_200,
      engineVersion: '1.6.0',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'shift_duration_exceeds_maximum', severity: 'warning' }),
      ]),
    });
    expect(finalized).toMatchObject({
      version: 3,
      status: 'finalized',
      result: { totalGrossPayMinor: 117_200, engineVersion: '1.6.0' },
    });
    expect(saveSnapshot).toHaveBeenCalledWith(finalized);
    expect(JSON.stringify(legacySnapshotV1.result)).toBe(legacyV1Json);
    expect(JSON.stringify(legacySnapshot.result)).toBe(legacyV2Json);
  });

  it('isolates profile-scoped evidence by the effective-dated resolved profile', async () => {
    const oldProfile = createSalaryProfile({ id: 'old-profile', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', baseHourlyRateMinor: 6000 });
    const currentProfile = createSalaryProfile({ id: 'current-profile', effectiveFrom: '2026-07-01', baseHourlyRateMinor: 6000 });
    const shift = createShift({
      scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T12:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
    });
    const oldEvidence = createCalendarEvidenceInterval({
      id: 'old-evidence', salaryProfileId: oldProfile.id,
      start: shift.scheduledStart!, end: shift.scheduledEnd!,
    });
    const listOverlapping = jest.fn().mockResolvedValue([oldEvidence]);
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([oldProfile, currentProfile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      calendarEvidenceIntervals: { listOverlapping } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-07-15T12:00:00+03:00');

    expect(listOverlapping).toHaveBeenCalledWith(expect.objectContaining({ salaryProfileId: currentProfile.id }));
    expect(result.specialIntervalEvaluations).toBeUndefined();
    expect(result.totalGrossPayMinor).toBe(24000);
  });

  it('allocates a cross-month shift by segment and assigns fixed components to its start date', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000, defaultShiftBonusMinor: 1000, defaultTravelReimbursementMinor: 500 });
    const shift = createShift({ scheduledStart: '2026-07-31T23:00:00+03:00', scheduledEnd: '2026-08-01T02:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'] });
    const coordinator = new SalaryCalculationCoordinator(deps);
    const july = await coordinator.calculateMany([shift], '2026-08-01T03:00:00+03:00', undefined, { reportingRange: { start: '2026-07-01T00:00:00+03:00', end: '2026-08-01T00:00:00+03:00' } });
    const august = await coordinator.calculateMany([shift], '2026-08-01T03:00:00+03:00', undefined, { reportingRange: { start: '2026-08-01T00:00:00+03:00', end: '2026-09-01T00:00:00+03:00' } });
    expect(july.futureMinor).toBe(7500);
    expect(august.futureMinor).toBe(12000);
    expect(july.futureMinor + august.futureMinor).toBe(19500);
  });

  it('rejects cross-workplace role and archived explicit profile references', async () => {
    const archived = createSalaryProfile({ id: 'archived', workplaceId: 'workplace-2', isActive: false, isArchived: true });
    const shift = createShift({ roleId: 'foreign-role', salaryProfileId: archived.id, expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const deps = repositories({
      workplaces: { list: jest.fn().mockResolvedValue([{ id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 6000, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]), listRoles: jest.fn().mockResolvedValue([{ id: 'foreign-role', workplaceId: 'workplace-2', name: 'Other', hourlyRateMinor: 20000, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]) } as unknown as SalaryCoordinatorRepositories['workplaces'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([]), getById: jest.fn().mockResolvedValue(archived) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
    });
    const result = await new SalaryCalculationCoordinator(deps).previewShift(shift, '2026-07-15T08:00:00+03:00');
    expect(result.totalGrossPayMinor).toBeUndefined();
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['invalid_role_reference', 'invalid_salary_profile_reference']));
  });

  it('resolves effective profile dates and report component dates in the profile timezone', async () => {
    const shift = createShift({ timezone: 'UTC', scheduledStart: '2026-07-31T21:30:00Z', scheduledEnd: '2026-07-31T22:30:00Z', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const profile = createSalaryProfile({ timezone: 'Asia/Jerusalem', effectiveFrom: '2026-08-01', baseHourlyRateMinor: 6000, defaultShiftBonusMinor: 100 });
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'] });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([shift], '2026-08-01T00:00:00Z');
    expect(summary.futureMinor).toBe(6100);
    expect(summary.byDate['2026-08-01']?.totalMinor).toBe(6100);
  });

  it('accumulates daily thresholds in the calculation timezone rather than the shift timezone', async () => {
    const profile = createSalaryProfile({ timezone: 'Asia/Jerusalem', baseHourlyRateMinor: 6000 });
    const threshold = createPayRule({ id: 'timezone-daily', conditions: [{ type: 'workedMinutes', afterMinutes: 180, scope: 'day', basis: 'net' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const first = createShift({ id: 'tz-first', timezone: 'UTC', scheduledStart: '2026-07-31T21:00:00Z', scheduledEnd: '2026-07-31T23:00:00Z', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const second = createShift({ id: 'tz-second', timezone: 'UTC', scheduledStart: '2026-08-01T00:00:00Z', scheduledEnd: '2026-08-01T02:00:00Z', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const deps = repositories({ salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'], payRules: { listForProfile: jest.fn().mockResolvedValue([threshold]) } as unknown as SalaryCoordinatorRepositories['payRules'] });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([first, second], '2026-08-01T03:00:00Z');
    expect(summary.resultsByShiftId[second.id]?.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([[60, 10000], [60, 12500]]);
  });

  it('counts an incomplete predecessor toward a configured successor daily threshold', async () => {
    const secondProfile = createSalaryProfile({ id: 'second-profile', workplaceId: 'workplace-2', baseHourlyRateMinor: 6000 });
    const threshold = createPayRule({ id: 'daily-after-missing', salaryProfileId: secondProfile.id, conditions: [{ type: 'workedMinutes', afterMinutes: 240, scope: 'day', basis: 'net' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const first = createShift({ id: 'missing-first', workplaceId: 'workplace-1', scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T12:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const second = createShift({ id: 'configured-second', workplaceId: 'workplace-2', scheduledStart: '2026-07-15T13:00:00+03:00', scheduledEnd: '2026-07-15T17:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const workplaces = [
      { id: 'workplace-1', name: 'Missing', defaultHourlyRateMinor: 0, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' },
      { id: 'workplace-2', name: 'Configured', defaultHourlyRateMinor: 0, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' },
    ];
    const deps = repositories({
      workplaces: { list: jest.fn().mockResolvedValue(workplaces), listRoles: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['workplaces'],
      salaryProfiles: { listByWorkplace: jest.fn((id: string) => Promise.resolve(id === 'workplace-2' ? [secondProfile] : [])), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([threshold]) } as unknown as SalaryCoordinatorRepositories['payRules'],
    });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([first, second], '2026-07-15T18:00:00+03:00');
    expect(summary.resultsByShiftId[first.id]?.totalGrossPayMinor).toBeUndefined();
    expect(summary.resultsByShiftId[second.id]?.specialRateMinutes).toBe(240);
  });

  it('loads prior same-workweek context across a month boundary without exposing context-only money', async () => {
    const profile = createSalaryProfile({
      baseHourlyRateMinor: 6000,
      workweekStartWeekday: 0,
      weeklyOvertimeEnabled: true,
      weeklyRegularMinutes: 600,
      weeklyOvertimeMultiplierBasisPoints: 12500,
    });
    const first = createShift({
      id: 'july-context', status: 'completed',
      actualStart: '2026-07-31T08:00:00+03:00', actualEnd: '2026-07-31T16:00:00+03:00',
      payableStart: '2026-07-31T08:00:00+03:00', payableEnd: '2026-07-31T16:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-31T16:00:00+03:00',
      salaryCalculationStatus: 'finalized', hourlyRateSnapshotMinor: 6000,
    });
    const second = createShift({
      id: 'august-target', status: 'completed',
      actualStart: '2026-08-01T08:00:00+03:00', actualEnd: '2026-08-01T12:00:00+03:00',
      payableStart: '2026-08-01T08:00:00+03:00', payableEnd: '2026-08-01T12:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-08-01T12:00:00+03:00',
      hourlyRateSnapshotMinor: 6000,
    });
    const firstResult = calculateSalary({ shift: first, profile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: first.completedAt! });
    const firstSnapshot = { id: 'july-snapshot', shiftId: first.id, version: 1, status: 'finalized' as const, salaryProfileId: profile.id, result: firstResult, isCurrent: true, createdAt: first.completedAt! };
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([first, second]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn() } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([firstSnapshot]) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });

    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([second], second.completedAt!);

    expect(summary.resultsByShiftId[first.id]).toBeUndefined();
    expect(summary.resultsByShiftId[second.id]?.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([[120, 10000], [120, 12500]]);
    expect(summary).toMatchObject({ earnedMinor: 27000, basePayMinor: 24000, premiumPayMinor: 3000 });
    expect(deps.shifts.list).toHaveBeenCalledWith(expect.objectContaining({
      workplaceId: second.workplaceId,
      statuses: ['completed'],
      rangeSource: 'salary',
    }));
  });

  it('loads context for an explicit week-scoped rule while isolating incompatible profiles', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000, workweekStartWeekday: 1 });
    const otherProfile = createSalaryProfile({ id: 'other-profile', baseHourlyRateMinor: 6000, workweekStartWeekday: 1 });
    const weeklyRule = createPayRule({
      id: 'persisted-weekly', salaryProfileId: profile.id,
      conditions: [{ type: 'workedMinutes', afterMinutes: 120, scope: 'week', basis: 'net' }],
      effect: { type: 'multiplier', basisPoints: 12500 },
    });
    const incompatible = createShift({
      id: 'other-profile-shift', salaryProfileId: otherProfile.id, status: 'completed',
      actualStart: '2026-07-20T08:00:00+03:00', actualEnd: '2026-07-20T10:00:00+03:00',
      payableStart: '2026-07-20T08:00:00+03:00', payableEnd: '2026-07-20T10:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-20T10:00:00+03:00', hourlyRateSnapshotMinor: 6000,
    });
    const target = createShift({
      id: 'profile-target', salaryProfileId: profile.id, status: 'completed',
      actualStart: '2026-07-20T11:00:00+03:00', actualEnd: '2026-07-20T13:00:00+03:00',
      payableStart: '2026-07-20T11:00:00+03:00', payableEnd: '2026-07-20T13:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-20T13:00:00+03:00', hourlyRateSnapshotMinor: 6000,
    });
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([incompatible, target]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile, otherProfile]), getById: jest.fn((id: string) => Promise.resolve(id === profile.id ? profile : otherProfile)) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn((id: string) => Promise.resolve(id === profile.id ? [weeklyRule] : [])) } as unknown as SalaryCoordinatorRepositories['payRules'],
    });

    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([target], target.completedAt!);

    expect(summary.resultsByShiftId[incompatible.id]).toBeUndefined();
    expect(summary.resultsByShiftId[target.id]?.segments).toEqual([
      expect.objectContaining({ minutes: 120, multiplierBasisPoints: 10000 }),
    ]);
    expect(summary.resultsByShiftId[target.id]?.explanations).toContain('salary.explanations.weekly_overtime:persisted-weekly:120:12500:net');
  });

  it('does not count an earlier requested scheduled shift as worked weekly context', async () => {
    const profile = createSalaryProfile({
      baseHourlyRateMinor: 6000,
      weeklyOvertimeEnabled: true,
      weeklyRegularMinutes: 120,
      weeklyOvertimeMultiplierBasisPoints: 12500,
    });
    const scheduled = createShift({
      id: 'scheduled-predecessor', salaryProfileId: profile.id,
      scheduledStart: '2026-07-20T08:00:00+03:00', scheduledEnd: '2026-07-20T10:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 6000,
    });
    const completed = createShift({
      id: 'completed-target', salaryProfileId: profile.id, status: 'completed',
      actualStart: '2026-07-20T11:00:00+03:00', actualEnd: '2026-07-20T13:00:00+03:00',
      payableStart: '2026-07-20T11:00:00+03:00', payableEnd: '2026-07-20T13:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-20T13:00:00+03:00',
      hourlyRateSnapshotMinor: 6000,
    });
    const deps = repositories({
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn().mockResolvedValue(profile) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
    });

    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([scheduled, completed], completed.completedAt!);

    expect(summary.resultsByShiftId[completed.id]?.segments).toEqual([
      expect.objectContaining({ minutes: 120, multiplierBasisPoints: 10000 }),
    ]);
  });

  it('keeps hidden weekly context out of another requested profile daily threshold', async () => {
    const weeklyProfile = createSalaryProfile({
      id: 'weekly-profile', baseHourlyRateMinor: 6000,
      weeklyOvertimeEnabled: true, weeklyRegularMinutes: 600, weeklyOvertimeMultiplierBasisPoints: 12500,
    });
    const dailyProfile = createSalaryProfile({ id: 'daily-profile', baseHourlyRateMinor: 6000 });
    const dailyRule = createPayRule({
      id: 'daily-profile-rule', salaryProfileId: dailyProfile.id,
      conditions: [{ type: 'workedMinutes', afterMinutes: 120, scope: 'day', basis: 'net' }],
      effect: { type: 'multiplier', basisPoints: 12500 },
    });
    const hiddenWeeklyPredecessor = createShift({
      id: 'hidden-weekly-predecessor', salaryProfileId: weeklyProfile.id, status: 'completed',
      actualStart: '2026-07-20T08:00:00+03:00', actualEnd: '2026-07-20T10:00:00+03:00',
      payableStart: '2026-07-20T08:00:00+03:00', payableEnd: '2026-07-20T10:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-20T10:00:00+03:00', hourlyRateSnapshotMinor: 6000,
    });
    const dailyTarget = createShift({
      id: 'daily-target', salaryProfileId: dailyProfile.id,
      scheduledStart: '2026-07-20T11:00:00+03:00', scheduledEnd: '2026-07-20T13:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 6000,
    });
    const weeklyTarget = createShift({
      id: 'weekly-target', salaryProfileId: weeklyProfile.id,
      scheduledStart: '2026-07-20T14:00:00+03:00', scheduledEnd: '2026-07-20T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 6000,
    });
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([hiddenWeeklyPredecessor]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([weeklyProfile, dailyProfile]), getById: jest.fn((id: string) => Promise.resolve(id === weeklyProfile.id ? weeklyProfile : dailyProfile)) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn((id: string) => Promise.resolve(id === dailyProfile.id ? [dailyRule] : [])) } as unknown as SalaryCoordinatorRepositories['payRules'],
    });

    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([dailyTarget, weeklyTarget], '2026-07-20T17:00:00+03:00');

    expect(summary.resultsByShiftId[hiddenWeeklyPredecessor.id]).toBeUndefined();
    expect(summary.resultsByShiftId[dailyTarget.id]?.segments).toEqual([
      expect.objectContaining({ minutes: 120, multiplierBasisPoints: 10000 }),
    ]);
  });

  it('uses the same prior workweek context for recalculation preview and finalization', async () => {
    const profile = createSalaryProfile({
      baseHourlyRateMinor: 6000,
      weeklyOvertimeEnabled: true,
      weeklyRegularMinutes: 600,
      weeklyOvertimeMultiplierBasisPoints: 12500,
    });
    const predecessor = createShift({
      id: 'preview-predecessor', status: 'completed',
      actualStart: '2026-07-31T08:00:00+03:00', actualEnd: '2026-07-31T16:00:00+03:00',
      payableStart: '2026-07-31T08:00:00+03:00', payableEnd: '2026-07-31T16:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-31T16:00:00+03:00',
      salaryCalculationStatus: 'finalized', hourlyRateSnapshotMinor: 6000,
    });
    const target = createShift({
      id: 'preview-target', status: 'completed',
      actualStart: '2026-08-01T08:00:00+03:00', actualEnd: '2026-08-01T12:00:00+03:00',
      payableStart: '2026-08-01T08:00:00+03:00', payableEnd: '2026-08-01T12:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-08-01T12:00:00+03:00',
      salaryCalculationStatus: 'stale', hourlyRateSnapshotMinor: 6000,
    });
    const predecessorResult = calculateSalary({ shift: predecessor, profile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: predecessor.completedAt! });
    const predecessorSnapshot = { id: 'preview-predecessor-snapshot', shiftId: predecessor.id, version: 1, status: 'finalized' as const, salaryProfileId: profile.id, result: predecessorResult, isCurrent: true, createdAt: predecessor.completedAt! };
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([predecessor, target]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn().mockResolvedValue(profile) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([predecessorSnapshot]), listHistory: jest.fn().mockResolvedValue([]), saveSnapshot: jest.fn().mockResolvedValue(undefined) } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });
    const coordinator = new SalaryCalculationCoordinator(deps);

    const preview = await coordinator.previewShift(target, target.completedAt!, undefined, true);
    const finalized = await coordinator.finalizeCompletedShift(target, target.completedAt!, true);

    expect(preview.totalGrossPayMinor).toBe(27000);
    expect(finalized.result.totalGrossPayMinor).toBe(preview.totalGrossPayMinor);
    expect(finalized.result.segments).toEqual(preview.segments);
  });

  it('keeps frozen evidence provenance authoritative until explicit recalculation creates vN+1', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const shift = createShift({
      id: 'evidence-recalculation', status: 'completed',
      actualStart: '2026-07-15T08:00:00+03:00', actualEnd: '2026-07-15T12:00:00+03:00',
      payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T12:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-07-15T12:00:00+03:00',
      hourlyRateSnapshotMinor: 6000, salaryCalculationStatus: 'stale',
    });
    const oldEvidence = createCalendarEvidenceInterval({
      id: 'deleted-old-evidence', start: '2026-07-15T09:00:00+03:00', end: '2026-07-15T10:00:00+03:00',
    });
    const currentEvidence = createCalendarEvidenceInterval({
      id: 'current-evidence', start: '2026-07-15T10:00:00+03:00', end: '2026-07-15T11:00:00+03:00',
    });
    const rule = createPayRule({
      id: 'holiday-rate', premiumFamily: 'special_interval',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'multiplier', basisPoints: 15000 },
    });
    const frozenResult = calculateSalary({
      shift, profile, rules: [rule], breaks: [], holidayIntervals: [], specialIntervals: [oldEvidence],
      calculatedAt: '2026-07-15T12:00:00+03:00',
    });
    const frozenSnapshot = {
      id: 'salary-calculation-v1', shiftId: shift.id, version: 1, status: 'finalized' as const,
      salaryProfileId: profile.id, result: frozenResult, isCurrent: true, createdAt: frozenResult.calculatedAt,
    };
    const frozenJson = JSON.stringify(frozenSnapshot.result);
    const listOverlapping = jest.fn().mockResolvedValue([currentEvidence]);
    const saveSnapshot = jest.fn().mockResolvedValue(undefined);
    const deps = repositories({
      shifts: { list: jest.fn().mockResolvedValue([shift]) } as unknown as SalaryCoordinatorRepositories['shifts'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById: jest.fn().mockResolvedValue(profile) } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      payRules: { listForProfile: jest.fn().mockResolvedValue([rule]) } as unknown as SalaryCoordinatorRepositories['payRules'],
      calendarEvidenceIntervals: { listOverlapping } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
      salaryCalculations: {
        listCurrentForShifts: jest.fn().mockResolvedValue([frozenSnapshot]),
        listHistory: jest.fn().mockResolvedValue([frozenSnapshot]),
        saveSnapshot,
      } as unknown as SalaryCoordinatorRepositories['salaryCalculations'],
    });
    const coordinator = new SalaryCalculationCoordinator(deps);

    const frozen = await coordinator.calculateMany([shift], '2026-08-01T00:00:00+03:00');
    expect(frozen.resultsByShiftId[shift.id]?.specialIntervalEvaluations?.[0]?.intervalId).toBe(oldEvidence.id);
    expect(listOverlapping).not.toHaveBeenCalled();

    const preview = await coordinator.previewShift(shift, '2026-08-01T00:00:00+03:00', undefined, true);
    const recalculated = await coordinator.finalizeCompletedShift(shift, '2026-08-01T00:00:00+03:00', true);

    expect(preview.specialIntervalEvaluations?.[0]?.intervalId).toBe(currentEvidence.id);
    expect(recalculated).toMatchObject({ version: 2, status: 'finalized', isCurrent: true });
    expect(recalculated.result.specialIntervalEvaluations?.[0]?.intervalId).toBe(currentEvidence.id);
    expect(recalculated.result.segments).toEqual(preview.segments);
    expect(saveSnapshot).toHaveBeenCalledWith(recalculated);
    expect(JSON.stringify(frozenSnapshot.result)).toBe(frozenJson);
  });

  it('does not mix active provisional components into finalized report aggregates', async () => {
    const active = createShift({ status: 'active', actualStart: '2026-07-15T08:00:00+03:00', activeOrigin: 'scheduled', hourlyRateSnapshotMinor: 6000 });
    const deps = repositories({ workplaces: { list: jest.fn().mockResolvedValue([{ id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 6000, defaultBreakMinutes: 0, createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00' }]), listRoles: jest.fn().mockResolvedValue([]) } as unknown as SalaryCoordinatorRepositories['workplaces'] });
    const summary = await new SalaryCalculationCoordinator(deps).calculateMany([active], '2026-07-15T10:00:00+03:00', '2026-07-15T10:00:00+03:00');
    expect(summary.resultsByShiftId[active.id]?.totalGrossPayMinor).toBe(12000);
    expect(summary).toMatchObject({ earnedMinor: 0, futureMinor: 0, basePayMinor: 0, regularMinutes: 0 });
  });

  it('excludes every monetary component from aggregates when a shift calculation is incomplete', async () => {
    const shift = createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, fixedBonusOverrideMinor: 700 });
    const summary = await new SalaryCalculationCoordinator(repositories()).calculateMany([shift], '2026-07-15T10:00:00+03:00');
    expect(summary.resultsByShiftId[shift.id]).toMatchObject({ fixedBonusesMinor: 700, totalGrossPayMinor: undefined });
    expect(summary).toMatchObject({ futureMinor: 0, forecastMinor: 0, bonusesMinor: 0, basePayMinor: 0, regularMinutes: 0, incompleteShiftCount: 1 });
    expect(summary.byDate).toEqual({});
  });

  it('keeps annual dashboard repository work bounded by salary context, not row count', async () => {
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const requestedWorkplace = {
      id: 'workplace-1', name: 'Cafe', defaultHourlyRateMinor: 6000, defaultBreakMinutes: 0,
      createdAt: '2026-01-01T00:00:00+02:00', updatedAt: '2026-01-01T00:00:00+02:00',
    };
    const unrelatedWorkplaces = Array.from({ length: 250 }, (_, index) => ({
      ...requestedWorkplace,
      id: `unrelated-${index}`,
      name: `Unrelated ${index}`,
      salaryProfileId: `unrelated-profile-${index}`,
    }));
    const shifts = Array.from({ length: 365 }, (_, index) => {
      const start = new Date(Date.UTC(2026, 0, 1 + index, 6));
      const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
      return createShift({
        id: `annual-${index}`,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        expectedBreakMinutes: 0,
        hourlyRateSnapshotMinor: 0,
      });
    });
    const listRoles = jest.fn().mockResolvedValue([]);
    const getById = jest.fn().mockResolvedValue(null);
    const listOverlapping = jest.fn().mockResolvedValue([]);
    const getForProfile = jest.fn().mockResolvedValue(null);
    const deps = repositories({
      workplaces: { list: jest.fn().mockResolvedValue([requestedWorkplace, ...unrelatedWorkplaces]), listRoles } as unknown as SalaryCoordinatorRepositories['workplaces'],
      salaryProfiles: { listByWorkplace: jest.fn().mockResolvedValue([profile]), getById } as unknown as SalaryCoordinatorRepositories['salaryProfiles'],
      calendarEvidenceIntervals: { listOverlapping } as unknown as NonNullable<SalaryCoordinatorRepositories['calendarEvidenceIntervals']>,
      weeklyRestSchedules: { getForProfile } as unknown as NonNullable<SalaryCoordinatorRepositories['weeklyRestSchedules']>,
    });

    const result = await new SalaryCalculationCoordinator(deps).calculateMany(shifts, '2027-01-01T00:00:00Z');

    expect(Object.keys(result.resultsByShiftId)).toHaveLength(365);
    expect(listRoles).toHaveBeenCalledTimes(1);
    expect(listRoles).toHaveBeenCalledWith(requestedWorkplace.id);
    expect(getById).not.toHaveBeenCalled();
    expect(listOverlapping).toHaveBeenCalledTimes(1);
    expect(getForProfile).toHaveBeenCalledTimes(1);
  });
});
