import { TZDate } from '@date-fns/tz';
import { addDays, differenceInMinutes, format } from 'date-fns';

import type {
  BreakSession,
  HolidayInterval,
  MoneyRoundingMode,
  PayCalculationIssue,
  PayCalculationResult,
  PayRule,
  PayRuleCondition,
  SalaryProfile,
  Shift,
} from '@/domain/entities';
import { calculateMinutePay, roundRationalToMinor } from '@/shared/utils/money';
import { formatLocalDateKey, resolveLocalDateTime } from '@/shared/utils/zoned-time';
import { resolveHourlyRate } from './rate-resolution-service';
import { MAX_SHIFT_DURATION_MINUTES } from './shift-duration-policy';

export const SALARY_ENGINE_VERSION = '1.3.0';
export const DEFAULT_OVERTIME_TIER_ONE_RULE_ID = 'system-default-overtime-8-to-10-hours';
export const DEFAULT_OVERTIME_TIER_TWO_RULE_ID = 'system-default-overtime-10-to-12-hours';
export const DEFAULT_OVERTIME_TIER_ONE_RULE_NAME = 'salary.defaultOvertimeTierOneName';
export const DEFAULT_OVERTIME_TIER_TWO_RULE_NAME = 'salary.defaultOvertimeTierTwoName';
export const DEFAULT_OVERTIME_THRESHOLD_MINUTES = 8 * 60;
export const DEFAULT_SECOND_OVERTIME_THRESHOLD_MINUTES = 10 * 60;

export interface SalaryCalculationInput {
  shift: Shift;
  profile?: SalaryProfile;
  rules: readonly PayRule[];
  breaks: readonly BreakSession[];
  holidayIntervals: readonly HolidayInterval[];
  calculatedAt: string;
  activeEnd?: string;
  roleHourlyRateMinor?: number;
  workplaceHourlyRateMinor?: number;
  workplaceDefaultTravelReimbursementMinor?: number;
  workplaceDefaultShiftBonusMinor?: number;
  priorWorkedMinutesByLocalDate?: Readonly<Record<string, number>>;
  priorGrossMinutesByLocalDate?: Readonly<Record<string, number>>;
  ignoreHistoricalSnapshot?: boolean;
}

interface TimeRange { start: string; end: string }
interface WorkInterval extends TimeRange { minutes: number }

export function calculateSalary(input: SalaryCalculationInput): PayCalculationResult {
  const context = input.shift.status === 'completed' ? 'completed' : input.shift.status === 'active' ? 'active_provisional' : 'scheduled';
  const range = resolveSourceRange(input.shift, context, input.activeEnd);
  const timezone = input.profile?.timezone ?? input.shift.timezone;
  const grossMinutes = differenceInMinutes(range.end, range.start);
  const breakSummary = resolveBreaks(input, range, context);
  const usesDefaultOvertime = !hasConfiguredOvertimeRule(input.rules);
  const resolvedRules = usesDefaultOvertime
    ? [...input.rules, ...createDefaultOvertimeRules(input)]
    : input.rules;
  const enabledRules = resolvedRules.filter((rule) => isRuleEnabledForRange(rule, range, timezone));
  const boundaries = collectBoundaries(range, timezone, enabledRules, input.holidayIntervals, breakSummary.unpaidIntervals);
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
  const segments = [] as PayCalculationResult['segments'];
  const mode: MoneyRoundingMode = input.profile?.calculationRoundingMode ?? 'half_up';
  const shiftTypeMultiplier = input.shift.shiftTypePayMultiplierBasisPoints ?? 10_000;
  let cumulativeBaseNumerator = 0n;
  let cumulativePremiumNumerator = 0n;
  let roundedBaseMinor = 0;
  let roundedPremiumMinor = 0;

  for (const work of workIntervals) {
    let cursor = new Date(work.start).getTime();
    const intervalEnd = new Date(work.end).getTime();
    let allocatedMinutes = 0;
    while (allocatedMinutes < work.minutes) {
      const localDate = formatLocalDateKey(new Date(cursor), timezone);
      const currentDayMinutes = dailyWorked[localDate] ?? 0;
      const shiftGrossMinutes = differenceInMinutes(cursor, range.start);
      const currentDayGrossMinutes = (dailyGross[localDate] ?? 0) + grossMinutesWithinCurrentShiftDay(range.start, cursor, localDate, timezone);
      const splitAtMinutes = nextThresholdDistance(sortedRules, {
        shiftNet: shiftWorkedMinutes,
        dayNet: currentDayMinutes,
        shiftGross: shiftGrossMinutes,
        dayGross: currentDayGrossMinutes,
      });
      const remainingMinutes = work.minutes - allocatedMinutes;
      const segmentMinutes = splitAtMinutes !== undefined && splitAtMinutes > 0 && splitAtMinutes < remainingMinutes ? splitAtMinutes : remainingMinutes;
      const end = segmentMinutes === remainingMinutes ? intervalEnd : cursor + segmentMinutes * 60_000;
      const midpoint = new Date(cursor + Math.max(1, end - cursor) / 2);
      const matching = sortedRules.filter((rule) => isRuleEffectiveAt(rule, midpoint, timezone) && conditionsMatch(rule.conditions, midpoint, {
        shift: input.shift,
        timezone,
        holidayIntervals: input.holidayIntervals,
        grossMinutes,
        shiftWorkedMinutes,
        dayWorkedMinutes: currentDayMinutes,
        shiftGrossMinutes,
        dayGrossMinutes: currentDayGrossMinutes,
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
          appliedRuleIds: [...(rateOverride ? [rateOverride.id] : []), ...multiplier.rules.map((rule) => rule.id)],
          labels: [...(input.shift.shiftTypeNameSnapshot ? [input.shift.shiftTypeNameSnapshot] : []), ...multiplier.rules.map((rule) => rule.name)],
        });
      } else missingRateForInterval = true;
      shiftWorkedMinutes += segmentMinutes;
      dailyWorked[localDate] = currentDayMinutes + segmentMinutes;
      allocatedMinutes += segmentMinutes;
      cursor = end;
    }
  }

  const payableMinutes = workIntervals.reduce((total, item) => total + item.minutes, 0);
  if (grossMinutes > MAX_SHIFT_DURATION_MINUTES) {
    issues.push({
      code: 'shift_duration_exceeds_maximum',
      severity: 'error',
      messageKey: 'salary.issues.shiftDurationExceedsMaximum',
      metadata: { maximumMinutes: MAX_SHIFT_DURATION_MINUTES, grossMinutes },
    });
  }
  if ((missingRateForInterval || (payableMinutes > 0 && segments.length === 0)) && baseResolution.issue) issues.push(baseResolution.issue);
  const componentContext = {
    shift: input.shift, timezone, holidayIntervals: input.holidayIntervals, grossMinutes,
    shiftWorkedMinutes: payableMinutes, dayWorkedMinutes: 0, shiftGrossMinutes: grossMinutes, dayGrossMinutes: 0,
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

  return {
    context, calculationTimezone: timezone, sourceRange: range, workIntervals, grossMinutes, paidBreakMinutes: breakSummary.paidMinutes,
    unpaidBreakMinutes: breakSummary.unpaidMinutes, payableMinutes,
    regularMinutes: segments.filter((item) => item.multiplierBasisPoints === 10_000).reduce((sum, item) => sum + item.minutes, 0),
    specialRateMinutes: segments.filter((item) => item.multiplierBasisPoints !== 10_000).reduce((sum, item) => sum + item.minutes, 0),
    segments, basePayMinor, premiumPayMinor, minimumDurationAdjustmentMinutes, minimumDurationAdjustmentMinor,
    fixedBonusesMinor, reimbursementsMinor, totalGrossPayMinor, resolvedBaseHourlyRateMinor: resolvedBaseRate,
    shiftTypeName: input.shift.shiftTypeNameSnapshot,
    shiftTypeMultiplierBasisPoints: shiftTypeMultiplier,
    appliedRuleIds: allAppliedRules, issues, explanations, calculatedAt: input.calculatedAt, engineVersion: SALARY_ENGINE_VERSION,
  };
}

export function hasConfiguredOvertimeRule(rules: readonly PayRule[]): boolean {
  return rules.some((rule) => rule.effect.type === 'multiplier'
    && rule.conditions.some((condition) => condition.type === 'workedMinutes'));
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

function collectBoundaries(range: TimeRange, timezone: string, rules: readonly PayRule[], holidays: readonly HolidayInterval[], unpaid: readonly TimeRange[]): number[] {
  const start = Date.parse(range.start); const end = Date.parse(range.end); const values = new Set([start, end]);
  for (const item of [...holidays, ...unpaid]) { addBoundary(values, item.start, start, end); addBoundary(values, item.end, start, end); }
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
  shift: Shift; timezone: string; holidayIntervals: readonly HolidayInterval[]; grossMinutes: number; shiftWorkedMinutes: number; dayWorkedMinutes: number; shiftGrossMinutes: number; dayGrossMinutes: number;
}): boolean {
  const local = TZDate.tz(context.timezone, instant); const date = format(local, 'yyyy-MM-dd'); const time = format(local, 'HH:mm');
  return conditions.every((condition) => {
    switch (condition.type) {
      case 'weekday': return condition.weekdays.includes(local.getDay());
      case 'date': return condition.date === date;
      case 'workplace': return condition.workplaceId === context.shift.workplaceId;
      case 'role': return condition.roleId === context.shift.roleId;
      case 'minimumDuration': return context.grossMinutes >= condition.minutes;
      case 'holiday': return context.holidayIntervals.some((item) => instant.getTime() >= Date.parse(item.start) && instant.getTime() < Date.parse(item.end));
      case 'timeWindow': return isTimeInWindow(time, condition.startTime, condition.endTime);
      case 'weekend': return isInWeekWindow(local.getDay(), time, condition.startWeekday, condition.startTime, condition.endWeekday, condition.endTime);
      case 'workedMinutes': {
        const gross = condition.basis === 'gross';
        const worked = condition.scope === 'day'
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
function specificity(rule: PayRule): number { return rule.conditions.reduce((score, condition) => score + ({ date: 100, role: 60, workplace: 50, holiday: 40, weekend: 30, timeWindow: 20, weekday: 10, workedMinutes: 10, minimumDuration: 5 }[condition.type]), 0); }
function resolveMultiplier(
  rules: PayRule[],
  issues: PayCalculationIssue[],
  shiftTypeBasisPoints: number,
  _shiftTypeName?: string,
) {
  if (!rules.length) return { basisPoints: shiftTypeBasisPoints, rules: [] as PayRule[] };
  const nonStacking = rules.filter((rule) => !rule.canStack);
  const winner = nonStacking[0];
  if (winner && nonStacking[1] && winner.priority === nonStacking[1].priority && specificity(winner) === specificity(nonStacking[1])) {
    if (!issues.some((item) => item.code === 'equal_priority_rule_conflict')) issues.push({ code: 'equal_priority_rule_conflict', severity: 'warning', messageKey: 'salary.issues.equalPriorityRuleConflict', metadata: { ruleIds: [winner.id, nonStacking[1].id] } });
  }
  const stacking = rules.filter((rule) => rule.canStack);
  const applied = [...(winner ? [winner] : []), ...stacking];
  const winningRuleBasisPoints = winner?.effect.type === 'multiplier' ? winner.effect.basisPoints : 10_000;
  const initial = Math.max(shiftTypeBasisPoints, winningRuleBasisPoints);
  return { basisPoints: stacking.reduce((value, rule) => value + (rule.effect.type === 'multiplier' ? Math.max(0, rule.effect.basisPoints - 10_000) : 0), initial), rules: applied };
}
function nextThresholdDistance(rules: readonly PayRule[], worked: { shiftNet: number; dayNet: number; shiftGross: number; dayGross: number }): number | undefined {
  const distances = rules.flatMap((rule) => rule.conditions.flatMap((condition) => condition.type === 'workedMinutes'
    ? (() => {
      const current = condition.scope === 'day'
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
