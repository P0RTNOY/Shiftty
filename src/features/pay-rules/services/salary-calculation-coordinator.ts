import type { ActiveShiftRepository, PayRuleRepository, SalaryCalculationRepository, SalaryProfileRepository, ShiftRepository, WorkplaceRepository } from '@/domain/repositories';
import type { BreakSession, PayCalculationResult, Role, SalaryCalculationSnapshot, SalaryProfile, Shift, Workplace } from '@/domain/entities';
import { calculateSalary, NO_HOLIDAYS, type HolidayProvider } from '@/domain/services';
import { createId } from '@/shared/utils/id';
import { formatLocalDateKey, resolveLocalDateTime } from '@/shared/utils/zoned-time';

export interface SalaryCoordinatorRepositories {
  shifts: ShiftRepository;
  activeShifts: ActiveShiftRepository;
  workplaces: WorkplaceRepository;
  salaryProfiles: SalaryProfileRepository;
  payRules: PayRuleRepository;
  salaryCalculations: SalaryCalculationRepository;
}

export interface SalaryBatchResult {
  earnedMinor: number;
  futureMinor: number;
  forecastMinor: number;
  incompleteShiftCount: number;
  staleShiftCount: number;
  regularMinutes: number;
  specialRateMinutes: number;
  basePayMinor: number;
  premiumPayMinor: number;
  bonusesMinor: number;
  reimbursementsMinor: number;
  minimumAdjustmentsMinor: number;
  resultsByShiftId: Readonly<Record<string, PayCalculationResult>>;
  byWorkplace: Readonly<Record<string, SalaryBreakdownTotal>>;
  byRole: Readonly<Record<string, SalaryBreakdownTotal>>;
  byMultiplier: Readonly<Record<string, SalaryBreakdownTotal>>;
  byDate: Readonly<Record<string, SalaryBreakdownTotal>>;
}
export interface SalaryBreakdownTotal { minutes: number; totalMinor: number }
export interface SalaryBatchOptions {
  ignoreHistoricalSnapshotShiftIds?: ReadonlySet<string>;
  reportingRange?: { start: string; end: string };
}

export class SalaryCalculationCoordinator {
  constructor(private readonly repositories: SalaryCoordinatorRepositories, private readonly holidayProvider: HolidayProvider = NO_HOLIDAYS) {}

  async calculateMany(shifts: readonly Shift[], calculatedAt: string, activeEnd?: string, options: SalaryBatchOptions = {}): Promise<SalaryBatchResult> {
    const relevant = shifts.filter((shift) => ['scheduled', 'completed', 'active'].includes(shift.status));
    const context = await this.loadContext(relevant);
    const currentSnapshots = await this.repositories.salaryCalculations.listCurrentForShifts(relevant.map((shift) => shift.id));
    const snapshots = new Map(currentSnapshots.map((snapshot) => [snapshot.shiftId, snapshot]));
    const breaks = await this.repositories.activeShifts.listBreaksForShifts(relevant.filter((shift) => shift.status !== 'scheduled' && !snapshots.has(shift.id)).map((shift) => shift.id));
    const breaksByShift = groupBy(breaks, (item) => item.shiftId);
    const priorResults: PayCalculationResult[] = [];
    const output: SalaryBatchResult = { earnedMinor: 0, futureMinor: 0, forecastMinor: 0, incompleteShiftCount: 0, staleShiftCount: 0, regularMinutes: 0, specialRateMinutes: 0, basePayMinor: 0, premiumPayMinor: 0, bonusesMinor: 0, reimbursementsMinor: 0, minimumAdjustmentsMinor: 0, resultsByShiftId: {}, byWorkplace: {}, byRole: {}, byMultiplier: {}, byDate: {} };
    const results: Record<string, PayCalculationResult> = {};

    for (const shift of [...relevant].sort((left, right) => sourceStart(left).localeCompare(sourceStart(right)))) {
      const frozen = snapshots.get(shift.id);
      const useFrozen = shift.status === 'completed' && ['finalized', 'stale'].includes(shift.salaryCalculationStatus) && frozen?.status === 'finalized';
      const result = useFrozen ? frozen.result : await this.calculatePrepared(shift, context, calculatedAt, priorResults, activeEnd, options.ignoreHistoricalSnapshotShiftIds?.has(shift.id) ?? false, breaksByShift[shift.id] ?? []);
      results[shift.id] = result;
      if (shift.salaryCalculationStatus === 'stale') output.staleShiftCount += 1;
      const includedSegments = result.segments.filter((segment) => isInReportingRange(segment.start, options.reportingRange));
      const fixedComponentsIncluded = isInReportingRange(result.sourceRange.start, options.reportingRange);
      const isAggregateContext = shift.status !== 'active';
      const includedMinutes = includedSegments.reduce((sum, segment) => sum + segment.minutes, 0);
      const includedBase = includedSegments.reduce((sum, segment) => sum + segment.basePayMinor, 0);
      const includedPremium = includedSegments.reduce((sum, segment) => sum + segment.premiumPayMinor, 0);
      const includedBonus = fixedComponentsIncluded ? result.fixedBonusesMinor : 0;
      const includedReimbursement = fixedComponentsIncluded ? result.reimbursementsMinor : 0;
      const includedMinimum = fixedComponentsIncluded ? result.minimumDurationAdjustmentMinor : 0;
      const includedTotal = includedSegments.reduce((sum, segment) => sum + segment.totalPayMinor, 0) + includedBonus + includedReimbursement + includedMinimum;
      const shiftTouchesPeriod = includedSegments.length > 0 || fixedComponentsIncluded;
      const isCompleteAggregate = isAggregateContext && result.totalGrossPayMinor !== undefined;
      if (result.totalGrossPayMinor === undefined && shiftTouchesPeriod) output.incompleteShiftCount += 1;
      else if (isAggregateContext && shift.status === 'completed') output.earnedMinor += includedTotal;
      else if (isAggregateContext && shift.status === 'scheduled') output.futureMinor += includedTotal;
      if (isCompleteAggregate) {
        output.regularMinutes += includedSegments.filter((item) => item.multiplierBasisPoints === 10_000).reduce((sum, item) => sum + item.minutes, 0);
        output.specialRateMinutes += includedSegments.filter((item) => item.multiplierBasisPoints !== 10_000).reduce((sum, item) => sum + item.minutes, 0);
        output.basePayMinor += includedBase; output.premiumPayMinor += includedPremium;
        output.bonusesMinor += includedBonus; output.reimbursementsMinor += includedReimbursement; output.minimumAdjustmentsMinor += includedMinimum;
        addBreakdown(output.byWorkplace as Record<string, SalaryBreakdownTotal>, shift.workplaceId, includedMinutes, result.totalGrossPayMinor === undefined ? 0 : includedTotal);
        addBreakdown(output.byRole as Record<string, SalaryBreakdownTotal>, shift.roleId ?? 'none', includedMinutes, result.totalGrossPayMinor === undefined ? 0 : includedTotal);
      }
      if (isCompleteAggregate) for (const segment of includedSegments) {
        addBreakdown(output.byMultiplier as Record<string, SalaryBreakdownTotal>, String(segment.multiplierBasisPoints), segment.minutes, segment.totalPayMinor);
        addBreakdown(output.byDate as Record<string, SalaryBreakdownTotal>, segment.localDate, segment.minutes, segment.totalPayMinor);
      }
      if (isCompleteAggregate && fixedComponentsIncluded) addBreakdown(output.byDate as Record<string, SalaryBreakdownTotal>, formatLocalDateKey(result.sourceRange.start, result.calculationTimezone), 0, includedBonus + includedReimbursement + includedMinimum);
      priorResults.push(result);
    }
    output.forecastMinor = output.earnedMinor + output.futureMinor;
    output.resultsByShiftId = results;
    return output;
  }

  async finalizeCompletedShift(shift: Shift, calculatedAt: string, forceCurrentSettings = false): Promise<SalaryCalculationSnapshot> {
    if (shift.status !== 'completed') throw new Error('Only completed shifts can receive a finalized salary snapshot.');
    const context = await this.loadContext([shift]);
    const workplace = context.workplacesById[shift.workplaceId];
    const explicitProfile = shift.salaryProfileId ? context.profilesById[shift.salaryProfileId] : undefined;
    const workplaceProfile = workplace?.salaryProfileId ? context.profilesById[workplace.salaryProfileId] : undefined;
    const profile = explicitProfile?.workplaceId === shift.workplaceId && profileAppliesAt(explicitProfile, sourceStart(shift)) ? explicitProfile : resolveProfile(shift, context.profilesByWorkplace[shift.workplaceId] ?? []) ?? (workplaceProfile?.workplaceId === shift.workplaceId && profileAppliesAt(workplaceProfile, sourceStart(shift)) ? workplaceProfile : undefined);
    const calculationTimezone = profile?.timezone ?? shift.timezone;
    const localDate = formatLocalDateKey(shift.payableStart!, calculationTimezone);
    const localDayStart = resolveLocalDateTime(localDate, '00:00', calculationTimezone);
    const localDayEnd = resolveLocalDateTime(nextLocalDate(localDate), '00:00', calculationTimezone);
    const siblings = await this.repositories.shifts.list({ endsAfter: localDayStart, startsBefore: localDayEnd, rangeSource: 'salary' });
    const targetForCalculation = { ...shift, salaryCalculationStatus: forceCurrentSettings ? 'stale' as const : shift.salaryCalculationStatus };
    const cohort = [...siblings.filter((item) => item.id !== shift.id && item.status === 'completed'), targetForCalculation];
    const resolveCurrentRate = forceCurrentSettings || shift.salaryCalculationStatus !== 'finalized';
    const batch = await this.calculateMany(cohort, calculatedAt, undefined, resolveCurrentRate ? { ignoreHistoricalSnapshotShiftIds: new Set([shift.id]) } : {});
    const result = batch.resultsByShiftId[shift.id] ?? await this.calculatePrepared(targetForCalculation, context, calculatedAt, [], undefined, resolveCurrentRate);
    const history = await this.repositories.salaryCalculations.listHistory(shift.id);
    const snapshot: SalaryCalculationSnapshot = {
      id: createId('salary-calculation'), shiftId: shift.id,
      version: Math.max(0, ...history.map((item) => item.version)) + 1,
      status: result.totalGrossPayMinor === undefined ? 'incomplete' : 'finalized', salaryProfileId: profile?.id,
      result, isCurrent: true, createdAt: calculatedAt,
    };
    await this.repositories.salaryCalculations.saveSnapshot(snapshot);
    return snapshot;
  }

  async previewShift(shift: Shift, calculatedAt: string, activeEnd?: string, forceCurrentSettings = false): Promise<PayCalculationResult> {
    const context = await this.loadContext([shift]);
    return this.calculatePrepared(shift, context, calculatedAt, [], activeEnd, forceCurrentSettings);
  }

  private async loadContext(shifts: readonly Shift[]) {
    const workplaces = await this.repositories.workplaces.list();
    const workplaceIds = [...new Set(shifts.map((shift) => shift.workplaceId))];
    const profiles = (await Promise.all(workplaceIds.map((id) => this.repositories.salaryProfiles.listByWorkplace(id)))).flat();
    const explicitProfileIds = [...shifts.flatMap((shift) => shift.salaryProfileId ? [shift.salaryProfileId] : []), ...workplaces.flatMap((workplace) => workplace.salaryProfileId ? [workplace.salaryProfileId] : [])];
    const explicitProfiles = (await Promise.all(explicitProfileIds.filter((id) => !profiles.some((item) => item.id === id)).map((id) => this.repositories.salaryProfiles.getById(id)))).filter((item): item is SalaryProfile => Boolean(item));
    const allProfiles = [...profiles, ...explicitProfiles];
    const rules = (await Promise.all([...new Set(allProfiles.map((profile) => profile.id))].map((id) => this.repositories.payRules.listForProfile(id)))).flat();
    const roles = (await Promise.all(workplaces.map((workplace) => this.repositories.workplaces.listRoles(workplace.id)))).flat();
    return {
      workplacesById: Object.fromEntries(workplaces.map((item) => [item.id, item])) as Record<string, Workplace>,
      rolesById: Object.fromEntries(roles.map((item) => [item.id, item])) as Record<string, Role>,
      profilesByWorkplace: groupBy(allProfiles.filter((item) => item.workplaceId), (item) => item.workplaceId!),
      profilesById: Object.fromEntries(allProfiles.map((item) => [item.id, item])) as Record<string, SalaryProfile>,
      rulesByProfile: groupBy(rules, (item) => item.salaryProfileId),
    };
  }

  private async calculatePrepared(shift: Shift, context: Awaited<ReturnType<SalaryCalculationCoordinator['loadContext']>>, calculatedAt: string, priorResults: readonly PayCalculationResult[], activeEnd?: string, ignoreHistoricalSnapshot = false, preparedBreaks?: readonly BreakSession[]): Promise<PayCalculationResult> {
    const workplace = context.workplacesById[shift.workplaceId];
    const explicitProfile = shift.salaryProfileId ? context.profilesById[shift.salaryProfileId] : undefined;
    const explicitProfileValid = explicitProfile?.workplaceId === shift.workplaceId && profileAppliesAt(explicitProfile, sourceStart(shift));
    const workplaceProfile = workplace?.salaryProfileId ? context.profilesById[workplace.salaryProfileId] : undefined;
    const profile = explicitProfileValid ? explicitProfile : resolveProfile(shift, context.profilesByWorkplace[shift.workplaceId] ?? []) ?? (workplaceProfile?.workplaceId === shift.workplaceId && profileAppliesAt(workplaceProfile, sourceStart(shift)) ? workplaceProfile : undefined);
    const role = shift.roleId ? context.rolesById[shift.roleId] : undefined;
    const roleValid = !shift.roleId || (role?.workplaceId === shift.workplaceId && !role.isArchived);
    const rules = profile ? context.rulesByProfile[profile.id] ?? [] : [];
    const breaks = shift.status === 'scheduled' ? [] : preparedBreaks ?? await this.repositories.activeShifts.listBreaks(shift.id);
    const source = salarySourceRange(shift, activeEnd);
    const calculationTimezone = profile?.timezone ?? shift.timezone;
    const prior = accumulatePriorMinutes(priorResults, calculationTimezone, 'net');
    const priorGross = accumulatePriorMinutes(priorResults, calculationTimezone, 'gross');
    const result = calculateSalary({ shift, profile, rules, breaks,
      holidayIntervals: this.holidayProvider.getHolidayIntervals(source.start, source.end, profile?.timezone ?? shift.timezone), calculatedAt, activeEnd, roleHourlyRateMinor: roleValid ? role?.hourlyRateMinor : undefined,
      workplaceHourlyRateMinor: workplace?.defaultHourlyRateMinor,
      workplaceDefaultShiftBonusMinor: workplace?.defaultShiftBonusMinor,
      workplaceDefaultTravelReimbursementMinor: workplace?.defaultTravelReimbursementMinor,
      priorWorkedMinutesByLocalDate: prior, priorGrossMinutesByLocalDate: priorGross, ignoreHistoricalSnapshot });
    const conflicts = profileConflicts(shift, context.profilesByWorkplace[shift.workplaceId] ?? []);
    const runtimeIssues: PayCalculationResult['issues'] = [
      ...(conflicts ? [conflicts] : []),
      ...(shift.salaryProfileId && !explicitProfileValid ? [{ code: 'invalid_salary_profile_reference', severity: 'error' as const, messageKey: 'salary.issues.invalidProfileReference', metadata: { salaryProfileId: shift.salaryProfileId } }] : []),
      ...(!roleValid ? [{ code: 'invalid_role_reference', severity: 'error' as const, messageKey: 'salary.issues.invalidRoleReference', metadata: { roleId: shift.roleId } }] : []),
      ...(profile && rules.length === 0 ? [{ code: 'no_pay_rules_configured', severity: 'warning' as const, messageKey: 'salary.noPayRules' }] : []),
    ];
    return runtimeIssues.some((issue) => issue.severity === 'error')
      ? { ...result, totalGrossPayMinor: undefined, issues: [...result.issues, ...runtimeIssues] }
      : runtimeIssues.length ? { ...result, issues: [...result.issues, ...runtimeIssues] } : result;
  }
}

function sourceStart(shift: Shift): string { return shift.payableStart ?? shift.actualStart ?? shift.scheduledStart ?? shift.createdAt; }
function salarySourceRange(shift: Shift, activeEnd?: string): { start: string; end: string } {
  if (shift.status === 'completed' && shift.payableStart && shift.payableEnd) return { start: shift.payableStart, end: shift.payableEnd };
  if (shift.status === 'active' && shift.actualStart && activeEnd) return { start: shift.actualStart, end: activeEnd };
  if (shift.status !== 'active' && shift.scheduledStart && shift.scheduledEnd) return { start: shift.scheduledStart, end: shift.scheduledEnd };
  throw new Error('The selected salary context has no complete time range.');
}
function isInReportingRange(instant: string, range?: { start: string; end: string }): boolean {
  if (!range) return true;
  const value = Date.parse(instant);
  return value >= Date.parse(range.start) && value < Date.parse(range.end);
}
function nextLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}
function accumulatePriorMinutes(results: readonly PayCalculationResult[], timezone: string, basis: 'net' | 'gross'): Record<string, number> {
  const output: Record<string, number> = {};
  for (const result of results) {
    const intervals = basis === 'net' ? result.workIntervals : [{ ...result.sourceRange, minutes: result.grossMinutes }];
    for (const interval of intervals) allocateIntervalMinutes(output, interval, timezone);
  }
  return output;
}
function allocateIntervalMinutes(output: Record<string, number>, interval: { start: string; end: string; minutes: number }, timezone: string): void {
  let cursor = Date.parse(interval.start); const end = Date.parse(interval.end); const totalMilliseconds = end - cursor;
  let elapsedMilliseconds = 0; let assignedMinutes = 0;
  while (cursor < end) {
    const localDate = formatLocalDateKey(new Date(cursor), timezone);
    const boundary = Date.parse(resolveLocalDateTime(nextLocalDate(localDate), '00:00', timezone));
    const segmentEnd = Math.min(end, boundary);
    elapsedMilliseconds += segmentEnd - cursor;
    const cumulativeMinutes = segmentEnd === end ? interval.minutes : Math.floor(interval.minutes * elapsedMilliseconds / totalMilliseconds);
    output[localDate] = (output[localDate] ?? 0) + cumulativeMinutes - assignedMinutes;
    assignedMinutes = cumulativeMinutes; cursor = segmentEnd;
  }
}
function resolveProfile(shift: Shift, profiles: readonly SalaryProfile[]): SalaryProfile | undefined {
  return [...profiles].filter((item) => profileAppliesAt(item, sourceStart(shift)))
    .sort((left, right) => (right.effectiveFrom ?? '').localeCompare(left.effectiveFrom ?? '') || right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))[0];
}
function profileConflicts(shift: Shift, profiles: readonly SalaryProfile[]): PayCalculationResult['issues'][number] | undefined {
  const matching = profiles.filter((item) => profileAppliesAt(item, sourceStart(shift)));
  return matching.length > 1 ? { code: 'overlapping_salary_profiles', severity: 'warning', messageKey: 'salary.issues.overlappingProfiles', metadata: { profileIds: matching.map((item) => item.id) } } : undefined;
}
function profileAppliesAt(profile: SalaryProfile, instant: string): boolean {
  const date = formatLocalDateKey(instant, profile.timezone);
  return profile.isActive && !profile.isArchived && (!profile.effectiveFrom || profile.effectiveFrom <= date) && (!profile.effectiveTo || profile.effectiveTo >= date);
}
function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> { const output: Record<string, T[]> = {}; for (const item of items) (output[key(item)] ??= []).push(item); return output; }
function addBreakdown(output: Record<string, SalaryBreakdownTotal>, key: string, minutes: number, totalMinor: number) { const item = output[key] ?? { minutes: 0, totalMinor: 0 }; item.minutes += minutes; item.totalMinor += totalMinor; output[key] = item; }
