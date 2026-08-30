import { TZDate } from '@date-fns/tz';
import { addDays, differenceInMinutes, format } from 'date-fns';

import type {
  BreakSession,
  CalendarEvidenceInterval,
  HolidayInterval,
  MoneyRoundingMode,
  PayCalculationIssue,
  PayCalculationResult,
  PayRule,
  PayRuleCondition,
  SalaryProfile,
  Shift,
} from '@/domain/entities';
import { calendarEvidenceIntervalSchema } from '@/domain/entities';
import { calculateMinutePay, roundRationalToMinor } from '@/shared/utils/money';
import { formatLocalDateKey, resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { resolveHourlyRate } from './rate-resolution-service';
import { MAX_SHIFT_DURATION_MINUTES } from './shift-duration-policy';

export const SALARY_ENGINE_VERSION = '1.6.0';
export const DEFAULT_OVERTIME_TIER_ONE_RULE_ID = 'system-default-overtime-8-to-10-hours';
export const DEFAULT_OVERTIME_TIER_TWO_RULE_ID = 'system-default-overtime-10-to-12-hours';
export const DEFAULT_OVERTIME_TIER_ONE_RULE_NAME = 'salary.defaultOvertimeTierOneName';
export const DEFAULT_OVERTIME_TIER_TWO_RULE_NAME = 'salary.defaultOvertimeTierTwoName';
export const DEFAULT_OVERTIME_THRESHOLD_MINUTES = 8 * 60;
export const DEFAULT_SECOND_OVERTIME_THRESHOLD_MINUTES = 10 * 60;
export const PROFILE_WEEKLY_OVERTIME_RULE_ID_PREFIX = 'system-weekly-overtime:';
export const PROFILE_WEEKLY_OVERTIME_RULE_NAME = 'salary.weeklyOvertimeRuleName';

export interface SalaryCalculationInput {
  shift: Shift;
  profile?: SalaryProfile;
  rules: readonly PayRule[];
  breaks: readonly BreakSession[];
  holidayIntervals: readonly HolidayInterval[];
  specialIntervals?: readonly CalendarEvidenceInterval[];
  calculatedAt: string;
  activeEnd?: string;
  roleHourlyRateMinor?: number;
  workplaceHourlyRateMinor?: number;
  workplaceDefaultTravelReimbursementMinor?: number;
  workplaceDefaultShiftBonusMinor?: number;
  priorWorkedMinutesByLocalDate?: Readonly<Record<string, number>>;
  priorGrossMinutesByLocalDate?: Readonly<Record<string, number>>;
  /** Prior payable minutes keyed by the profile-local YYYY-MM-DD workweek start. */
  priorWorkedMinutesByWorkweek?: Readonly<Record<string, number>>;
  /** Prior gross minutes keyed by the profile-local YYYY-MM-DD workweek start. */
  priorGrossMinutesByWorkweek?: Readonly<Record<string, number>>;
  ignoreHistoricalSnapshot?: boolean;
}

interface TimeRange { start: string; end: string }
interface WorkInterval extends TimeRange { minutes: number }

export function calculateSalary(input: SalaryCalculationInput): PayCalculationResult {
  return calculateSalaryInternal(input, true);
}

function calculateSalaryInternal(input: SalaryCalculationInput, analyzeSpecialContributions: boolean): PayCalculationResult {
  const context = input.shift.status === 'completed' ? 'completed' : input.shift.status === 'active' ? 'active_provisional' : 'scheduled';
  const range = resolveSourceRange(input.shift, context, input.activeEnd);
  const timezone = input.profile?.timezone ?? input.shift.timezone;
  const grossMinutes = differenceInMinutes(range.end, range.start);
  const breakSummary = resolveBreaks(input, range, context);
  const weeklyRule = createProfileWeeklyOvertimeRule(input.profile);
  const configuredRules = weeklyRule
    ? [...input.rules.filter((rule) => rule.id !== weeklyRule.id), weeklyRule]
    : input.rules;
  // A weekly opt-in complements the existing per-shift defaults. Only an
  // explicit shift/day threshold replaces those defaults.
  const usesDefaultOvertime = !hasConfiguredShiftOrDayOvertimeRule(input.rules);
  const resolvedRules = usesDefaultOvertime
    ? [...configuredRules, ...createDefaultOvertimeRules(input)]
    : configuredRules;
  const enabledRules = resolvedRules.filter((rule) => isRuleEnabledForRange(rule, range, timezone));
  const specialIntervals = normalizeSpecialIntervals(input.specialIntervals ?? [], input.shift, input.profile, range);
  const boundaries = collectBoundaries(range, timezone, enabledRules, input.holidayIntervals, specialIntervals, breakSummary.unpaidIntervals);
  const workIntervals = createWorkIntervals(boundaries, breakSummary.unpaidIntervals);
  const issues: PayCalculationIssue[] = usesDefaultOvertime ? [{
    code: 'default_overtime_applied',
    severity: 'warning',
    messageKey: 'salary.defaultOvertimeApplied',
  }] : [];
  const explanations = [
    context === 'completed' ? 'salary.explanations.used_payable_range' : context === 'scheduled' ? 'salary.explanations.used_scheduled_range' : 'salary.explanations.used_active_range',
    `salary.explanations.breaks:${breakSummary.unpaidMinutes}:${breakSummary.paidMinutes}`,
    usesDefaultOvertime ? 'salary.explanations.default_overtime' : 'salary.explanations.configured_overtime',
    ...weeklyOvertimeExplanations(enabledRules),
    ...(specialIntervals.length ? [`salary.explanations.special_intervals:${specialIntervals.length}`] : []),
  ];
  const sortedRules = [...enabledRules].sort(compareRules);
  const baseResolution = resolveHourlyRate({
    shift: input.shift,
    profile: input.profile,
    roleHourlyRateMinor: input.roleHourlyRateMinor,
    workplaceHourlyRateMinor: input.workplaceHourlyRateMinor,
    ignoreHistoricalSnapshot: input.ignoreHistoricalSnapshot,
  });
  let shiftWorkedMinutes = 0;
  let missingRateForInterval = false;
  const dailyWorked = { ...(input.priorWorkedMinutesByLocalDate ?? {}) };
  const dailyGross = { ...(input.priorGrossMinutesByLocalDate ?? {}) };
  const weeklyWorked = { ...(input.priorWorkedMinutesByWorkweek ?? {}) };
  const weeklyGross = { ...(input.priorGrossMinutesByWorkweek ?? {}) };
  const workweekStartWeekday = input.profile?.workweekStartWeekday ?? 0;
  const segments = [] as PayCalculationResult['segments'];
  const mode: MoneyRoundingMode = input.profile?.calculationRoundingMode ?? 'half_up';
  const shiftTypeMultiplier = input.shift.shiftTypePayMultiplierBasisPoints ?? 10_000;
  let cumulativeBaseNumerator = 0n;
  let cumulativePremiumNumerator = 0n;
  let roundedBaseMinor = 0;
  let roundedPremiumMinor = 0;
  const configuredRuleIds = new Set(input.rules.map((rule) => rule.id));
  const applicableSpecialRuleIdsByIntervalId = new Map<string, Set<string>>();

  for (const work of workIntervals) {
    let cursor = new Date(work.start).getTime();
    const intervalEnd = new Date(work.end).getTime();
    let allocatedMinutes = 0;
    while (allocatedMinutes < work.minutes) {
      const localDate = formatLocalDateKey(new Date(cursor), timezone);
      const localWorkweek = formatLocalWorkweekKey(new Date(cursor), timezone, workweekStartWeekday);
      const currentDayMinutes = dailyWorked[localDate] ?? 0;
      const currentWeekMinutes = weeklyWorked[localWorkweek] ?? 0;
      const shiftGrossMinutes = differenceInMinutes(cursor, range.start);
      const currentDayGrossMinutes = (dailyGross[localDate] ?? 0) + grossMinutesWithinCurrentShiftDay(range.start, cursor, localDate, timezone);
      const currentWeekGrossMinutes = (weeklyGross[localWorkweek] ?? 0) + grossMinutesWithinCurrentShiftWorkweek(range.start, cursor, localWorkweek, timezone);
      const splitAtMinutes = nextThresholdDistance(sortedRules, {
        shiftNet: shiftWorkedMinutes,
        dayNet: currentDayMinutes,
        weekNet: currentWeekMinutes,
        shiftGross: shiftGrossMinutes,
        dayGross: currentDayGrossMinutes,
        weekGross: currentWeekGrossMinutes,
      });
      const remainingMinutes = work.minutes - allocatedMinutes;
      const segmentMinutes = splitAtMinutes !== undefined && splitAtMinutes > 0 && splitAtMinutes < remainingMinutes ? splitAtMinutes : remainingMinutes;
      const end = segmentMinutes === remainingMinutes ? intervalEnd : cursor + segmentMinutes * 60_000;
      const midpoint = new Date(cursor + Math.max(1, end - cursor) / 2);
      const matching = sortedRules.filter((rule) => isRuleEffectiveAt(rule, midpoint, timezone) && conditionsMatch(rule.conditions, midpoint, {
        shift: input.shift,
        timezone,
        holidayIntervals: input.holidayIntervals,
        specialIntervals,
        grossMinutes,
        shiftWorkedMinutes,
        dayWorkedMinutes: currentDayMinutes,
        weekWorkedMinutes: currentWeekMinutes,
        shiftGrossMinutes,
        dayGrossMinutes: currentDayGrossMinutes,
        weekGrossMinutes: currentWeekGrossMinutes,
      }));
      const rateOverride = matching.find((rule) => rule.effect.type === 'rateOverride');
      const rateResolution = resolveHourlyRate({
        shift: input.shift,
        profile: input.profile,
        dateOverrideMinor: rateOverride?.effect.type === 'rateOverride' ? rateOverride.effect.hourlyRateMinor : undefined,
        roleHourlyRateMinor: input.roleHourlyRateMinor,
        workplaceHourlyRateMinor: input.workplaceHourlyRateMinor,
        ignoreHistoricalSnapshot: input.ignoreHistoricalSnapshot,
      });
      const rateMinor = rateResolution.rateMinor ?? baseResolution.rateMinor;
      const multiplierRules = matching.filter((rule) => rule.effect.type === 'multiplier');
      const multiplier = resolveMultiplier(
        multiplierRules,
        issues,
        shiftTypeMultiplier,
        input.shift.shiftTypeNameSnapshot,
      );
      const appliedSegmentRules = [...(rateOverride ? [rateOverride] : []), ...multiplier.rules];
      const matchingSpecialIntervals = specialIntervals.filter((interval) => intervalContains(interval, midpoint));
      for (const interval of matchingSpecialIntervals) {
        const applicableRuleIds = applicableSpecialRuleIdsByIntervalId.get(interval.id) ?? new Set<string>();
        for (const rule of matching) {
          if (configuredRuleIds.has(rule.id) && ruleTargetsInterval(rule, interval)) applicableRuleIds.add(rule.id);
        }
        applicableSpecialRuleIdsByIntervalId.set(interval.id, applicableRuleIds);
      }
      if (rateMinor) {
        cumulativeBaseNumerator += BigInt(rateMinor) * BigInt(segmentMinutes) * 10_000n;
        cumulativePremiumNumerator += BigInt(rateMinor) * BigInt(segmentMinutes) * BigInt(multiplier.basisPoints - 10_000);
        const nextRoundedBase = roundRationalToMinor(cumulativeBaseNumerator, 60n * 10_000n, mode);
        const nextRoundedPremium = roundRationalToMinor(cumulativePremiumNumerator, 60n * 10_000n, mode);
        const basePayMinor = nextRoundedBase - roundedBaseMinor;
        const premiumPayMinor = nextRoundedPremium - roundedPremiumMinor;
        const totalPayMinor = basePayMinor + premiumPayMinor;
        roundedBaseMinor = nextRoundedBase;
        roundedPremiumMinor = nextRoundedPremium;
        segments.push({
          start: new Date(cursor).toISOString(), end: new Date(end).toISOString(), localDate, minutes: segmentMinutes,
          baseHourlyRateMinor: rateMinor, multiplierBasisPoints: multiplier.basisPoints, basePayMinor,
          premiumPayMinor, totalPayMinor,
          appliedRuleIds: appliedSegmentRules.map((rule) => rule.id),
          labels: [...(input.shift.shiftTypeNameSnapshot ? [input.shift.shiftTypeNameSnapshot] : []), ...multiplier.rules.map((rule) => rule.name)],
          specialIntervalIds: matchingSpecialIntervals.length ? matchingSpecialIntervals.map((interval) => interval.id) : undefined,
        });
      } else missingRateForInterval = true;
      shiftWorkedMinutes += segmentMinutes;
      dailyWorked[localDate] = currentDayMinutes + segmentMinutes;
      weeklyWorked[localWorkweek] = currentWeekMinutes + segmentMinutes;
      allocatedMinutes += segmentMinutes;
      cursor = end;
    }
  }

  const payableMinutes = workIntervals.reduce((total, item) => total + item.minutes, 0);
  const workweekAllocations = createWorkweekAllocations(
    range,
    grossMinutes,
    workIntervals,
    timezone,
    workweekStartWeekday,
  );
  if (grossMinutes > MAX_SHIFT_DURATION_MINUTES) {
    issues.push({
      code: 'shift_duration_exceeds_maximum',
      severity: 'warning',
      messageKey: 'salary.issues.shiftDurationExceedsMaximum',
      metadata: { maximumMinutes: MAX_SHIFT_DURATION_MINUTES, grossMinutes },
    });
  }
  if ((missingRateForInterval || (payableMinutes > 0 && segments.length === 0)) && baseResolution.issue) issues.push(baseResolution.issue);
  const componentContext = {
    shift: input.shift, timezone, holidayIntervals: input.holidayIntervals, specialIntervals, grossMinutes,
    shiftWorkedMinutes: payableMinutes, dayWorkedMinutes: 0, weekWorkedMinutes: 0,
    shiftGrossMinutes: grossMinutes, dayGrossMinutes: 0, weekGrossMinutes: 0,
  };
  const componentRules = sortedRules.filter((rule) => ['fixedBonus', 'reimbursement', 'minimumPaidDuration'].includes(rule.effect.type) && workIntervals.some((work) => {
    const midpoint = new Date((Date.parse(work.start) + Date.parse(work.end)) / 2);
    return isRuleEffectiveAt(rule, midpoint, timezone) && conditionsMatch(rule.conditions, midpoint, componentContext);
  }));
  const defaultBonusMinor = input.profile ? input.profile.defaultShiftBonusMinor : (input.workplaceDefaultShiftBonusMinor ?? 0);
  const defaultTravelMinor = input.profile ? input.profile.defaultTravelReimbursementMinor : (input.workplaceDefaultTravelReimbursementMinor ?? 0);
  const fixedBonusesMinor = input.shift.fixedBonusOverrideMinor ?? (defaultBonusMinor + sumRuleAmounts(componentRules, 'fixedBonus'));
  const reimbursementsMinor = input.shift.travelReimbursementOverrideMinor ?? (defaultTravelMinor + sumRuleAmounts(componentRules, 'reimbursement'));
  const minimumMinutes = componentRules.reduce((maximum, rule) => rule.effect.type === 'minimumPaidDuration' ? Math.max(maximum, rule.effect.minutes) : maximum, 0);
  const minimumDurationAdjustmentMinutes = Math.max(0, minimumMinutes - payableMinutes);
  const resolvedBaseRate = segments[0]?.baseHourlyRateMinor ?? baseResolution.rateMinor;
  const minimumDurationAdjustmentMinor = resolvedBaseRate
    ? calculateMinutePay(resolvedBaseRate, minimumDurationAdjustmentMinutes, shiftTypeMultiplier, mode)
    : 0;
  const basePayMinor = segments.reduce((sum, item) => sum + item.basePayMinor, 0);
  const premiumPayMinor = segments.reduce((sum, item) => sum + item.premiumPayMinor, 0);
  const allAppliedRules = [...new Set([...segments.flatMap((item) => item.appliedRuleIds), ...componentRules.map((rule) => rule.id)])];
  const hasError = issues.some((issue) => issue.severity === 'error');
  const totalGrossPayMinor = hasError ? undefined : basePayMinor + premiumPayMinor + minimumDurationAdjustmentMinor + fixedBonusesMinor + reimbursementsMinor;
  const contributionByRuleCohort = new Map<string, boolean>();
  const ruleCohortChangesEstimate = (ruleIds: readonly string[]): boolean => {
    if (!analyzeSpecialContributions) return false;
    const configuredCohort = [...new Set(ruleIds.filter((ruleId) => configuredRuleIds.has(ruleId)))].sort();
    if (!configuredCohort.length) return false;
    const cohortKey = JSON.stringify(configuredCohort);
    const cached = contributionByRuleCohort.get(cohortKey);
    if (cached !== undefined) return cached;
    const excludedRuleIds = new Set(configuredCohort);
    const counterfactual = calculateSalaryInternal({
      ...input,
      rules: input.rules.filter((rule) => !excludedRuleIds.has(rule.id)),
    }, false);
    const changed = monetaryFingerprint({
      basePayMinor,
      premiumPayMinor,
      minimumDurationAdjustmentMinor,
      fixedBonusesMinor,
      reimbursementsMinor,
      totalGrossPayMinor,
    }) !== monetaryFingerprint(counterfactual);
    contributionByRuleCohort.set(cohortKey, changed);
    return changed;
  };
  const specialIntervalEvaluations = specialIntervals.map((interval) => {
    const applicableComponentRuleIds = componentRules.filter((rule) => ruleTargetsInterval(rule, interval) && workIntervals.some((work) => {
      const midpoint = new Date((Date.parse(work.start) + Date.parse(work.end)) / 2);
      return intervalContains(interval, midpoint) && isRuleEffectiveAt(rule, midpoint, timezone)
        && conditionsMatch(rule.conditions, midpoint, { ...componentContext, holidayIntervals: [], specialIntervals: [interval] });
    })).map((rule) => rule.id);
    const appliedRuleIds = [...new Set([
      ...segments.flatMap((segment) => segment.specialIntervalIds?.includes(interval.id)
        ? segment.appliedRuleIds.filter((ruleId) => {
          const rule = sortedRules.find((candidate) => candidate.id === ruleId);
          return rule ? ruleTargetsInterval(rule, interval) : false;
        })
        : []),
      ...applicableComponentRuleIds,
    ])].sort();
    const applicableRuleCohortIds = [
      ...(applicableSpecialRuleIdsByIntervalId.get(interval.id) ?? []),
      ...applicableComponentRuleIds,
    ];
    return {
      intervalId: interval.id,
      scheduleId: interval.scheduleId,
      type: interval.type,
      name: interval.name,
      start: interval.start,
      end: interval.end,
      timezone: interval.timezone,
      sourceKind: interval.sourceKind,
      sourceTitle: interval.sourceTitle,
      sourceUrl: interval.sourceUrl,
      presetId: interval.presetId,
      presetVersion: interval.presetVersion,
      confirmedAt: interval.confirmedAt,
      appliedRuleIds,
      contributedToEstimate: appliedRuleIds.length > 0 && ruleCohortChangesEstimate(applicableRuleCohortIds),
    };
  });

  return {
    context, calculationTimezone: timezone, sourceRange: range, workIntervals, grossMinutes, paidBreakMinutes: breakSummary.paidMinutes,
    unpaidBreakMinutes: breakSummary.unpaidMinutes, payableMinutes, workweekAllocations,
    regularMinutes: segments.filter((item) => item.multiplierBasisPoints === 10_000).reduce((sum, item) => sum + item.minutes, 0),
    specialRateMinutes: segments.filter((item) => item.multiplierBasisPoints !== 10_000).reduce((sum, item) => sum + item.minutes, 0),
    segments, basePayMinor, premiumPayMinor, minimumDurationAdjustmentMinutes, minimumDurationAdjustmentMinor,
    fixedBonusesMinor, reimbursementsMinor, totalGrossPayMinor, resolvedBaseHourlyRateMinor: resolvedBaseRate,
    shiftTypeName: input.shift.shiftTypeNameSnapshot,
    shiftTypeMultiplierBasisPoints: shiftTypeMultiplier,
    appliedRuleIds: allAppliedRules, issues, explanations,
    specialIntervalEvaluations: specialIntervalEvaluations.length ? specialIntervalEvaluations : undefined,
    calculatedAt: input.calculatedAt, engineVersion: SALARY_ENGINE_VERSION,
  };
}

function monetaryFingerprint(value: Pick<PayCalculationResult,
  | 'basePayMinor'
  | 'premiumPayMinor'
  | 'minimumDurationAdjustmentMinor'
  | 'fixedBonusesMinor'
  | 'reimbursementsMinor'
  | 'totalGrossPayMinor'>): string {
  return [
    value.basePayMinor,
    value.premiumPayMinor,
    value.minimumDurationAdjustmentMinor,
    value.fixedBonusesMinor,
    value.reimbursementsMinor,
    value.totalGrossPayMinor ?? 'unavailable',
  ].join(':');
}

export function hasConfiguredOvertimeRule(rules: readonly PayRule[]): boolean {
  return rules.some((rule) => rule.effect.type === 'multiplier'
    && rule.conditions.some((condition) => condition.type === 'workedMinutes'));
}

function hasConfiguredShiftOrDayOvertimeRule(rules: readonly PayRule[]): boolean {
  return rules.some((rule) => rule.effect.type === 'multiplier'
    && rule.conditions.some((condition) => condition.type === 'workedMinutes' && condition.scope !== 'week'));
}

export function profileWeeklyOvertimeRuleId(profileId: string): string {
  return `${PROFILE_WEEKLY_OVERTIME_RULE_ID_PREFIX}${profileId}`;
}

export function createProfileWeeklyOvertimeRule(profile?: SalaryProfile): PayRule | undefined {
  if (!profile?.weeklyOvertimeEnabled
    || profile.weeklyRegularMinutes === undefined
    || profile.weeklyOvertimeMultiplierBasisPoints === undefined) return undefined;
  return {
    id: profileWeeklyOvertimeRuleId(profile.id),
    salaryProfileId: profile.id,
    name: PROFILE_WEEKLY_OVERTIME_RULE_NAME,
    priority: 0,
    conditions: [{
      type: 'workedMinutes',
      afterMinutes: profile.weeklyRegularMinutes,
      scope: 'week',
      basis: profile.weeklyOvertimeBasis,
    }],
    effect: { type: 'multiplier', basisPoints: profile.weeklyOvertimeMultiplierBasisPoints },
    isEnabled: true,
    canStack: true,
    effectiveFrom: profile.effectiveFrom,
    effectiveTo: profile.effectiveTo,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function weeklyOvertimeExplanations(rules: readonly PayRule[]): string[] {
  return rules.flatMap((rule) => {
    if (rule.effect.type !== 'multiplier') return [];
    const basisPoints = rule.effect.basisPoints;
    return rule.conditions.flatMap((condition) => condition.type === 'workedMinutes' && condition.scope === 'week'
      ? [`salary.explanations.weekly_overtime:${rule.id}:${condition.afterMinutes}:${basisPoints}:${condition.basis ?? 'net'}`]
      : []);
  });
}

function createDefaultOvertimeRules(input: SalaryCalculationInput): PayRule[] {
  const common = {
    salaryProfileId: input.profile?.id ?? `workplace:${input.shift.workplaceId}`,
    priority: 0,
    isEnabled: true,
    canStack: true,
    createdAt: input.calculatedAt,
    updatedAt: input.calculatedAt,
  };
  return [
    {
      ...common,
      id: DEFAULT_OVERTIME_TIER_ONE_RULE_ID,
      name: DEFAULT_OVERTIME_TIER_ONE_RULE_NAME,
      conditions: [{
        type: 'workedMinutes',
        afterMinutes: DEFAULT_OVERTIME_THRESHOLD_MINUTES,
        beforeMinutes: DEFAULT_SECOND_OVERTIME_THRESHOLD_MINUTES,
        scope: 'shift',
        basis: 'net',
      }],
      effect: { type: 'multiplier', basisPoints: 12_500 },
    },
    {
      ...common,
      id: DEFAULT_OVERTIME_TIER_TWO_RULE_ID,
      name: DEFAULT_OVERTIME_TIER_TWO_RULE_NAME,
      conditions: [{
        type: 'workedMinutes',
        afterMinutes: DEFAULT_SECOND_OVERTIME_THRESHOLD_MINUTES,
        scope: 'shift',
        basis: 'net',
      }],
      effect: { type: 'multiplier', basisPoints: 15_000 },
    },
  ];
}

function resolveSourceRange(shift: Shift, context: PayCalculationResult['context'], activeEnd?: string): TimeRange {
  const range = context === 'completed' && shift.payableStart && shift.payableEnd
    ? { start: shift.payableStart, end: shift.payableEnd }
    : context === 'active_provisional' && shift.actualStart && activeEnd
      ? { start: shift.actualStart, end: activeEnd }
      : context !== 'active_provisional' && shift.scheduledStart && shift.scheduledEnd
        ? { start: shift.scheduledStart, end: shift.scheduledEnd }
        : undefined;
  if (range && Date.parse(range.end) > Date.parse(range.start)) return range;
  if (range) throw new Error('Salary calculation end must be after its start.');
  throw new Error('The selected salary context has no complete time range.');
}

function resolveBreaks(input: SalaryCalculationInput, range: TimeRange, context: PayCalculationResult['context']) {
  const startMs = Date.parse(range.start); const endMs = Date.parse(range.end);
  const clipped = input.breaks.flatMap((item) => {
    const start = Math.max(startMs, Date.parse(item.start));
    const rawEnd = item.end ? Date.parse(item.end) : context === 'active_provisional' ? endMs : start;
    const end = Math.min(endMs, rawEnd);
    return end > start ? [{ start: new Date(start).toISOString(), end: new Date(end).toISOString(), isPaid: item.isPaid, minutes: differenceInMinutes(end, start) }] : [];
  });
  const scheduledPaidMinutes = context === 'scheduled' && input.profile?.breakPolicy === 'paid' ? input.shift.expectedBreakMinutes : 0;
  const paidMinutes = clipped.filter((item) => item.isPaid).reduce((sum, item) => sum + item.minutes, 0) + scheduledPaidMinutes;
  const persistedUnpaid = context === 'completed'
    ? input.shift.payableBreakMinutes ?? 0
    : context === 'scheduled'
      ? input.profile?.breakPolicy === 'unpaid'
        ? input.shift.expectedBreakMinutes
        : input.profile?.breakPolicy === 'paid'
          ? 0
          : undefined
      : undefined;
  const availableUnpaid = clipped.filter((item) => !item.isPaid);
  const desired = persistedUnpaid ?? availableUnpaid.reduce((sum, item) => sum + item.minutes, 0);
  const unpaidIntervals: TimeRange[] = [];
  let remaining = desired;
  for (const item of availableUnpaid) {
    if (remaining <= 0) break;
    const minutes = Math.min(item.minutes, remaining);
    unpaidIntervals.push({ start: item.start, end: new Date(Date.parse(item.start) + minutes * 60_000).toISOString() });
    remaining -= minutes;
  }
  if (remaining > 0) unpaidIntervals.push({ start: new Date(endMs - remaining * 60_000).toISOString(), end: range.end });
  return { paidMinutes, unpaidMinutes: desired, unpaidIntervals: mergeRanges(unpaidIntervals) };
}

function normalizeSpecialIntervals(
  inputs: readonly CalendarEvidenceInterval[],
  shift: Shift,
  profile: SalaryProfile | undefined,
  range: TimeRange,
): CalendarEvidenceInterval[] {
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  const byId = new Map<string, CalendarEvidenceInterval>();
  for (const input of inputs) {
    const interval = calendarEvidenceIntervalSchema.parse(input);
    if (byId.has(interval.id)) throw new Error(`Duplicate calendar evidence interval ID: ${interval.id}`);
    byId.set(interval.id, interval);
  }
  return [...byId.values()].filter((interval) => !interval.isArchived
    && interval.workplaceId === shift.workplaceId
    && (!interval.salaryProfileId || interval.salaryProfileId === profile?.id)
    && Date.parse(interval.start) < end
    && Date.parse(interval.end) > start)
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start)
      || Date.parse(left.end) - Date.parse(right.end)
      || left.type.localeCompare(right.type)
      || left.id.localeCompare(right.id));
}

function collectBoundaries(range: TimeRange, timezone: string, rules: readonly PayRule[], holidays: readonly HolidayInterval[], specialIntervals: readonly CalendarEvidenceInterval[], unpaid: readonly TimeRange[]): number[] {
  const start = Date.parse(range.start); const end = Date.parse(range.end); const values = new Set([start, end]);
  for (const item of [...holidays, ...specialIntervals, ...unpaid]) { addBoundary(values, item.start, start, end); addBoundary(values, item.end, start, end); }
  let date = formatLocalDateKey(range.start, timezone);
  const finalDate = formatLocalDateKey(range.end, timezone);
  for (let guard = 0; guard < 370; guard += 1) {
    addBoundary(values, resolveLocalDateTime(date, '00:00', timezone), start, end);
    for (const rule of rules) for (const condition of rule.conditions) {
      if (condition.type === 'timeWindow') {
        addBoundary(values, resolveLocalDateTime(date, condition.startTime, timezone), start, end);
        addBoundary(values, resolveLocalDateTime(date, condition.endTime, timezone), start, end);
      }
      if (condition.type === 'weekend') {
        const day = TZDate.tz(timezone, new Date(resolveLocalDateTime(date, '12:00', timezone))).getDay();
        if (day === condition.startWeekday) addBoundary(values, resolveLocalDateTime(date, condition.startTime, timezone), start, end);
        if (day === condition.endWeekday) addBoundary(values, resolveLocalDateTime(date, condition.endTime, timezone), start, end);
      }
    }
    if (date === finalDate) break;
    date = format(addDays(TZDate.tz(timezone, new Date(resolveLocalDateTime(date, '12:00', timezone))), 1), 'yyyy-MM-dd');
  }
  return [...values].sort((left, right) => left - right);
}

function addBoundary(values: Set<number>, value: string, start: number, end: number) { const time = Date.parse(value); if (time > start && time < end) values.add(time); }
function intervalContains(interval: Pick<CalendarEvidenceInterval, 'start' | 'end'>, instant: Date): boolean {
  return instant.getTime() >= Date.parse(interval.start) && instant.getTime() < Date.parse(interval.end);
}
function ruleTargetsInterval(rule: PayRule, interval: CalendarEvidenceInterval): boolean {
  return rule.conditions.some((condition) => condition.type === 'specialInterval'
    ? condition.intervalTypes.includes(interval.type)
    : condition.type === 'holiday' && interval.type === 'holiday');
}
function createWorkIntervals(boundaries: readonly number[], unpaid: readonly TimeRange[]): WorkInterval[] {
  const output: WorkInterval[] = [];
  let accumulatedWorkedMilliseconds = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]!; const end = boundaries[index + 1]!; const midpoint = start + (end - start) / 2;
    if (unpaid.some((item) => midpoint >= Date.parse(item.start) && midpoint < Date.parse(item.end))) continue;
    const previousMinutes = Math.floor(accumulatedWorkedMilliseconds / 60_000);
    accumulatedWorkedMilliseconds += end - start;
    const minutes = Math.floor(accumulatedWorkedMilliseconds / 60_000) - previousMinutes;
    if (minutes > 0) output.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes });
  }
  return output;
}

function conditionsMatch(conditions: readonly PayRuleCondition[], instant: Date, context: {
  shift: Shift; timezone: string; holidayIntervals: readonly HolidayInterval[]; specialIntervals: readonly CalendarEvidenceInterval[]; grossMinutes: number;
  shiftWorkedMinutes: number; dayWorkedMinutes: number; weekWorkedMinutes: number;
  shiftGrossMinutes: number; dayGrossMinutes: number; weekGrossMinutes: number;
}): boolean {
  const local = TZDate.tz(context.timezone, instant); const date = format(local, 'yyyy-MM-dd'); const time = format(local, 'HH:mm');
  return conditions.every((condition) => {
    switch (condition.type) {
      case 'weekday': return condition.weekdays.includes(local.getDay());
      case 'date': return condition.date === date;
      case 'workplace': return condition.workplaceId === context.shift.workplaceId;
      case 'role': return condition.roleId === context.shift.roleId;
      case 'minimumDuration': return context.grossMinutes >= condition.minutes;
      case 'holiday': return context.holidayIntervals.some((item) => instant.getTime() >= Date.parse(item.start) && instant.getTime() < Date.parse(item.end))
        || context.specialIntervals.some((item) => item.type === 'holiday' && intervalContains(item, instant));
      case 'specialInterval': return context.specialIntervals.some((item) => condition.intervalTypes.includes(item.type) && intervalContains(item, instant));
      case 'timeWindow': return isTimeInWindow(time, condition.startTime, condition.endTime);
      case 'weekend': return isInWeekWindow(local.getDay(), time, condition.startWeekday, condition.startTime, condition.endWeekday, condition.endTime);
      case 'workedMinutes': {
        const gross = condition.basis === 'gross';
        const worked = condition.scope === 'week'
          ? gross ? context.weekGrossMinutes : context.weekWorkedMinutes
          : condition.scope === 'day'
            ? gross ? context.dayGrossMinutes : context.dayWorkedMinutes
            : gross ? context.shiftGrossMinutes : context.shiftWorkedMinutes;
        return worked >= condition.afterMinutes && (condition.beforeMinutes === undefined || worked < condition.beforeMinutes);
      }
    }
  });
}

function isRuleEnabledForRange(rule: PayRule, range: TimeRange, timezone: string): boolean {
  if (!rule.isEnabled) return false;
  const startDate = formatLocalDateKey(range.start, timezone); const endDate = formatLocalDateKey(range.end, timezone);
  return (!rule.effectiveFrom || endDate >= rule.effectiveFrom) && (!rule.effectiveTo || startDate <= rule.effectiveTo);
}
function isRuleEffectiveAt(rule: PayRule, instant: Date, timezone: string): boolean {
  const date = formatLocalDateKey(instant, timezone);
  return (!rule.effectiveFrom || date >= rule.effectiveFrom) && (!rule.effectiveTo || date <= rule.effectiveTo);
}
function compareRules(left: PayRule, right: PayRule): number { return right.priority - left.priority || specificity(right) - specificity(left) || left.id.localeCompare(right.id); }
function specificity(rule: PayRule): number { return rule.conditions.reduce((score, condition) => score + ({ date: 100, role: 60, workplace: 50, holiday: 40, specialInterval: 40, weekend: 30, timeWindow: 20, weekday: 10, workedMinutes: 10, minimumDuration: 5 }[condition.type]), 0); }
function resolveMultiplier(
  rules: PayRule[],
  issues: PayCalculationIssue[],
  shiftTypeBasisPoints: number,
  _shiftTypeName?: string,
) {
  if (!rules.length) return { basisPoints: shiftTypeBasisPoints, rules: [] as PayRule[] };
  const overtimeRules = rules.filter((rule) => resolvePremiumFamily(rule) === 'overtime');
  const specialRules = rules.filter((rule) => resolvePremiumFamily(rule) === 'special_interval');
  const ordinaryRules = rules.filter((rule) => resolvePremiumFamily(rule) === 'ordinary');
  const overtimeWinner = [...overtimeRules].sort(compareOvertimeStrength)[0];
  const ordinaryNonStacking = [...ordinaryRules.filter((rule) => !rule.canStack)].sort(compareRules);
  const specialNonStacking = [...specialRules.filter((rule) => !rule.canStack)].sort(compareMultiplierStrength);
  const specialWinner = specialNonStacking[0];
  const legacyConflictCandidates = [...ordinaryNonStacking, ...(overtimeWinner && !overtimeWinner.canStack ? [overtimeWinner] : [])].sort(compareRules);
  const legacyWinner = legacyConflictCandidates[0];
  const winner = specialWinner && legacyWinner
    ? [specialWinner, legacyWinner].sort(compareMultiplierStrength)[0]
    : specialWinner ?? legacyWinner;
  const conflictPair = legacyConflictCandidates[0] && legacyConflictCandidates[1]
    && legacyConflictCandidates[0].priority === legacyConflictCandidates[1].priority
    && specificity(legacyConflictCandidates[0]) === specificity(legacyConflictCandidates[1])
    ? [legacyConflictCandidates[0], legacyConflictCandidates[1]] as const
    : specialNonStacking[0] && specialNonStacking[1]
      && specialNonStacking[0].effect.type === 'multiplier' && specialNonStacking[1].effect.type === 'multiplier'
      && specialNonStacking[0].effect.basisPoints === specialNonStacking[1].effect.basisPoints
      && specialNonStacking[0].priority === specialNonStacking[1].priority
      && specificity(specialNonStacking[0]) === specificity(specialNonStacking[1])
      ? [specialNonStacking[0], specialNonStacking[1]] as const
      : undefined;
  if (conflictPair) {
    if (!issues.some((item) => item.code === 'equal_priority_rule_conflict')) issues.push({ code: 'equal_priority_rule_conflict', severity: 'warning', messageKey: 'salary.issues.equalPriorityRuleConflict', metadata: { ruleIds: conflictPair.map((rule) => rule.id) } });
  }
  const stacking = [...ordinaryRules.filter((rule) => rule.canStack), ...specialRules.filter((rule) => rule.canStack)]
    .sort(compareRules).filter((rule, index, all) => all.findIndex((candidate) => candidate.id === rule.id) === index);
  const applied = [...(winner ? [winner] : []), ...stacking, ...(overtimeWinner?.canStack ? [overtimeWinner] : [])];
  const winningRuleBasisPoints = winner?.effect.type === 'multiplier' ? winner.effect.basisPoints : 10_000;
  const initial = Math.max(shiftTypeBasisPoints, winningRuleBasisPoints);
  const ordinaryBasisPoints = stacking.reduce((value, rule) => value + (rule.effect.type === 'multiplier' ? Math.max(0, rule.effect.basisPoints - 10_000) : 0), initial);
  const overtimePremium = overtimeWinner?.canStack && overtimeWinner.effect.type === 'multiplier'
    ? Math.max(0, overtimeWinner.effect.basisPoints - 10_000)
    : 0;
  return { basisPoints: ordinaryBasisPoints + overtimePremium, rules: applied };
}

function isOvertimeMultiplierRule(rule: PayRule): boolean {
  return rule.effect.type === 'multiplier' && rule.conditions.some((condition) => condition.type === 'workedMinutes');
}

function resolvePremiumFamily(rule: PayRule): NonNullable<PayRule['premiumFamily']> {
  if (rule.premiumFamily) return rule.premiumFamily;
  if (isOvertimeMultiplierRule(rule)) return 'overtime';
  if (rule.conditions.some((condition) => condition.type === 'specialInterval')) return 'special_interval';
  return 'ordinary';
}

function compareOvertimeStrength(left: PayRule, right: PayRule): number {
  const leftBasisPoints = left.effect.type === 'multiplier' ? left.effect.basisPoints : 10_000;
  const rightBasisPoints = right.effect.type === 'multiplier' ? right.effect.basisPoints : 10_000;
  return rightBasisPoints - leftBasisPoints || compareRules(left, right);
}

function compareMultiplierStrength(left: PayRule, right: PayRule): number {
  const leftBasisPoints = left.effect.type === 'multiplier' ? left.effect.basisPoints : 10_000;
  const rightBasisPoints = right.effect.type === 'multiplier' ? right.effect.basisPoints : 10_000;
  return rightBasisPoints - leftBasisPoints || compareRules(left, right);
}

function nextThresholdDistance(rules: readonly PayRule[], worked: { shiftNet: number; dayNet: number; weekNet: number; shiftGross: number; dayGross: number; weekGross: number }): number | undefined {
  const distances = rules.flatMap((rule) => rule.conditions.flatMap((condition) => condition.type === 'workedMinutes'
    ? (() => {
      const current = condition.scope === 'week'
        ? condition.basis === 'gross' ? worked.weekGross : worked.weekNet
        : condition.scope === 'day'
          ? condition.basis === 'gross' ? worked.dayGross : worked.dayNet
          : condition.basis === 'gross' ? worked.shiftGross : worked.shiftNet;
      return [condition.afterMinutes - current, ...(condition.beforeMinutes ? [condition.beforeMinutes - current] : [])];
    })()
    : [])).filter((value) => value > 0);
  return distances.length ? Math.min(...distances) : undefined;
}

function grossMinutesWithinCurrentShiftDay(rangeStart: string, cursor: number, localDate: string, timezone: string): number {
  const localMidnight = Date.parse(resolveLocalDateTime(localDate, '00:00', timezone));
  return differenceInMinutes(cursor, Math.max(Date.parse(rangeStart), localMidnight));
}

function grossMinutesWithinCurrentShiftWorkweek(rangeStart: string, cursor: number, workweekStart: string, timezone: string): number {
  const localWorkweekStart = Date.parse(resolveLocalDateTime(workweekStart, '00:00', timezone));
  return differenceInMinutes(cursor, Math.max(Date.parse(rangeStart), localWorkweekStart));
}

export function formatLocalWorkweekKey(instant: Date | string, timezone: string, workweekStartWeekday: number): string {
  if (!Number.isInteger(workweekStartWeekday) || workweekStartWeekday < 0 || workweekStartWeekday > 6) {
    throw new Error('Workweek start weekday must be an integer from 0 through 6.');
  }
  const local = TZDate.tz(timezone, new Date(instant));
  const localDate = format(local, 'yyyy-MM-dd');
  const daysSinceStart = (local.getDay() - workweekStartWeekday + 7) % 7;
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - daysSinceStart)).toISOString().slice(0, 10);
}

function createWorkweekAllocations(
  range: TimeRange,
  grossMinutes: number,
  workIntervals: readonly WorkInterval[],
  timezone: string,
  workweekStartWeekday: number,
): NonNullable<PayCalculationResult['workweekAllocations']> {
  const allocations: Record<string, { startLocalDate: string; netMinutes: number; grossMinutes: number }> = {};
  const get = (key: string) => allocations[key] ??= { startLocalDate: key, netMinutes: 0, grossMinutes: 0 };

  for (const interval of workIntervals) {
    get(formatLocalWorkweekKey(interval.start, timezone, workweekStartWeekday)).netMinutes += interval.minutes;
  }

  let cursor = Date.parse(range.start);
  const end = Date.parse(range.end);
  const totalMilliseconds = end - cursor;
  let elapsedMilliseconds = 0;
  let assignedMinutes = 0;
  while (cursor < end) {
    const localDate = formatLocalDateKey(new Date(cursor), timezone);
    const nextDate = nextLocalDateKey(localDate);
    const segmentEnd = Math.min(end, Date.parse(resolveLocalDateTime(nextDate, '00:00', timezone)));
    elapsedMilliseconds += segmentEnd - cursor;
    const cumulativeMinutes = segmentEnd === end
      ? grossMinutes
      : Math.floor(grossMinutes * elapsedMilliseconds / totalMilliseconds);
    const key = formatLocalWorkweekKey(new Date(cursor), timezone, workweekStartWeekday);
    get(key).grossMinutes += cumulativeMinutes - assignedMinutes;
    assignedMinutes = cumulativeMinutes;
    cursor = segmentEnd;
  }

  return Object.values(allocations).sort((left, right) => left.startLocalDate.localeCompare(right.startLocalDate));
}

function nextLocalDateKey(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

function sumRuleAmounts(rules: readonly PayRule[], type: 'fixedBonus' | 'reimbursement'): number { return rules.reduce((sum, rule) => rule.effect.type === type ? sum + rule.effect.amountMinor : sum, 0); }
function isTimeInWindow(value: string, start: string, end: string): boolean { return start < end ? value >= start && value < end : value >= start || value < end; }
function isInWeekWindow(day: number, time: string, startDay: number, startTime: string, endDay: number, endTime: string): boolean {
  const point = day * 1440 + toMinute(time); const start = startDay * 1440 + toMinute(startTime); let end = endDay * 1440 + toMinute(endTime);
  if (end <= start) end += 7 * 1440;
  return (point >= start && point < end) || (point + 7 * 1440 >= start && point + 7 * 1440 < end);
}
function toMinute(value: string): number { const [hours = '0', minutes = '0'] = value.split(':'); return Number(hours) * 60 + Number(minutes); }
function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)); const result: TimeRange[] = [];
  for (const range of sorted) { const previous = result.at(-1); if (previous && Date.parse(range.start) <= Date.parse(previous.end)) previous.end = new Date(Math.max(Date.parse(previous.end), Date.parse(range.end))).toISOString(); else result.push({ ...range }); }
  return result;
}
