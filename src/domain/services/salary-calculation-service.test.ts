import { calculateSalary } from '@/domain/services/salary-calculation-service';
import type { PayRule } from '@/domain/entities';
import { createBreak, createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';

const calculatedAt = '2026-07-31T12:00:00+03:00';
const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
const regularShift = createShift({ scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T16:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
const calculate = (shift = regularShift, rules: PayRule[] = [], extra = {}) => calculateSalary({ shift, profile, rules, breaks: [], holidayIntervals: [], calculatedAt, ...extra });

describe('salary calculation engine', () => {
  it('calculates one regular future segment using minute/basis-point arithmetic', () => {
    const result = calculate();
    expect(result).toMatchObject({ context: 'scheduled', grossMinutes: 480, payableMinutes: 480, regularMinutes: 480, specialRateMinutes: 0, basePayMinor: 48000, premiumPayMinor: 0, totalGrossPayMinor: 48000, issues: [] });
    expect(result.segments).toHaveLength(1);
  });

  it('uses finalized payable range and payable break override for completed shifts', () => {
    const shift = createShift({ status: 'completed', actualStart: '2026-07-15T07:50:00+03:00', actualEnd: '2026-07-15T16:20:00+03:00', payableStart: '2026-07-15T08:00:00+03:00', payableEnd: '2026-07-15T16:00:00+03:00', payableBreakMinutes: 30, payableSource: 'manual', completedAt: calculatedAt, hourlyRateSnapshotMinor: 6000 });
    const result = calculate(shift, [], { breaks: [createBreak({ start: '2026-07-15T12:00:00+03:00', end: '2026-07-15T12:30:00+03:00' })] });
    expect(result).toMatchObject({ context: 'completed', grossMinutes: 480, unpaidBreakMinutes: 30, payableMinutes: 450, totalGrossPayMinor: 45000 });
    expect(result.explanations.join(' ')).toContain('payable');
  });

  it('does not deduct paid breaks', () => {
    const result = calculate(regularShift, [], { breaks: [createBreak({ shiftId: regularShift.id, start: '2026-07-15T12:00:00+03:00', end: '2026-07-15T12:30:00+03:00', isPaid: true })] });
    expect(result.paidBreakMinutes).toBe(30); expect(result.unpaidBreakMinutes).toBe(0); expect(result.payableMinutes).toBe(480);
  });

  it('honors a paid expected-break policy for future shifts', () => {
    const shift = createShift({ scheduledStart: regularShift.scheduledStart, scheduledEnd: regularShift.scheduledEnd, expectedBreakMinutes: 30, hourlyRateSnapshotMinor: 0 });
    const result = calculateSalary({ shift, profile: createSalaryProfile({ baseHourlyRateMinor: 6000, breakPolicy: 'paid' }), rules: [], breaks: [], holidayIntervals: [], calculatedAt });
    expect(result).toMatchObject({ grossMinutes: 480, paidBreakMinutes: 30, unpaidBreakMinutes: 0, payableMinutes: 480, totalGrossPayMinor: 48000 });
  });

  it('does not deduct a planned break when the policy only pays recorded break sessions', () => {
    const shift = createShift({ scheduledStart: regularShift.scheduledStart, scheduledEnd: regularShift.scheduledEnd, expectedBreakMinutes: 30, hourlyRateSnapshotMinor: 0 });
    const result = calculateSalary({ shift, profile: createSalaryProfile({ baseHourlyRateMinor: 6000, breakPolicy: 'perBreak' }), rules: [], breaks: [], holidayIntervals: [], calculatedAt });

    expect(result).toMatchObject({ grossMinutes: 480, paidBreakMinutes: 0, unpaidBreakMinutes: 0, payableMinutes: 480, totalGrossPayMinor: 48000 });
  });

  it('still deducts a planned break when an unpaid expected-break policy is explicit', () => {
    const shift = createShift({ scheduledStart: regularShift.scheduledStart, scheduledEnd: regularShift.scheduledEnd, expectedBreakMinutes: 30, hourlyRateSnapshotMinor: 0 });
    const result = calculateSalary({ shift, profile: createSalaryProfile({ baseHourlyRateMinor: 6000, breakPolicy: 'unpaid' }), rules: [], breaks: [], holidayIntervals: [], calculatedAt });

    expect(result).toMatchObject({ grossMinutes: 480, paidBreakMinutes: 0, unpaidBreakMinutes: 30, payableMinutes: 450, totalGrossPayMinor: 45000 });
  });

  it('splits a cross-midnight night window into regular and special segments', () => {
    const shift = createShift({ scheduledStart: '2026-07-15T20:00:00+03:00', scheduledEnd: '2026-07-16T02:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const night = createPayRule({ id: 'night', name: 'Night', conditions: [{ type: 'timeWindow', startTime: '22:00', endTime: '06:00' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const result = calculate(shift, [night]);
    expect(result.segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[120, 10000], [120, 12500], [120, 12500]]);
    expect(result.regularMinutes).toBe(120); expect(result.specialRateMinutes).toBe(240);
  });

  it('uses priority, specificity, and stable id for non-stacking rules', () => {
    const rules = [
      createPayRule({ id: 'z-rule', priority: 10, effect: { type: 'multiplier', basisPoints: 12500 } }),
      createPayRule({ id: 'a-rule', priority: 10, effect: { type: 'multiplier', basisPoints: 15000 } }),
    ];
    const result = calculate(regularShift, rules);
    expect(result.segments[0]).toMatchObject({ multiplierBasisPoints: 15000, appliedRuleIds: ['a-rule'] });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'equal_priority_rule_conflict', severity: 'warning' }));
  });

  it('adds stacking premiums rather than multiplying multipliers', () => {
    const result = calculate(regularShift, [
      createPayRule({ id: 'weekend', name: 'Weekend', priority: 20, effect: { type: 'multiplier', basisPoints: 15000 } }),
      createPayRule({ id: 'night', name: 'Night', priority: 10, canStack: true, effect: { type: 'multiplier', basisPoints: 12500 } }),
    ]);
    expect(result.segments[0]?.multiplierBasisPoints).toBe(17500);
    expect(result.segments[0]?.labels).toEqual(expect.arrayContaining(['Weekend', 'Night']));
  });

  it('applies fixed bonuses, travel, minimum duration, and explicit overrides once', () => {
    const short = createShift({ scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T09:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, fixedBonusOverrideMinor: 900, travelReimbursementOverrideMinor: 1200 });
    const result = calculate(short, [createPayRule({ id: 'minimum', effect: { type: 'minimumPaidDuration', minutes: 180 } }), createPayRule({ id: 'bonus', effect: { type: 'fixedBonus', amountMinor: 500 } }), createPayRule({ id: 'travel', effect: { type: 'reimbursement', amountMinor: 700 } })]);
    expect(result).toMatchObject({ payableMinutes: 60, minimumDurationAdjustmentMinutes: 120, fixedBonusesMinor: 900, reimbursementsMinor: 1200, totalGrossPayMinor: 20100 });
  });

  it('adds configured profile defaults and each fixed rule exactly once', () => {
    const configured = createSalaryProfile({ baseHourlyRateMinor: 6000, defaultShiftBonusMinor: 100, defaultTravelReimbursementMinor: 200 });
    const result = calculateSalary({ shift: regularShift, profile: configured, rules: [createPayRule({ id: 'bonus-a', effect: { type: 'fixedBonus', amountMinor: 300 } }), createPayRule({ id: 'bonus-b', effect: { type: 'fixedBonus', amountMinor: 400 } }), createPayRule({ id: 'travel', effect: { type: 'reimbursement', amountMinor: 500 } })], breaks: [], holidayIntervals: [], calculatedAt });
    expect(result).toMatchObject({ fixedBonusesMinor: 800, reimbursementsMinor: 700, totalGrossPayMinor: 49500 });
  });

  it('supports date overrides, holidays, weekends, and effective/disabled rules', () => {
    const rules = [
      createPayRule({ id: 'date-rate', priority: 50, conditions: [{ type: 'date', date: '2026-07-15' }], effect: { type: 'rateOverride', hourlyRateMinor: 8000 } }),
      createPayRule({ id: 'holiday', conditions: [{ type: 'holiday' }], effect: { type: 'multiplier', basisPoints: 15000 } }),
      createPayRule({ id: 'disabled', isEnabled: false, effect: { type: 'multiplier', basisPoints: 30000 } }),
      createPayRule({ id: 'expired', effectiveTo: '2026-07-14', effect: { type: 'multiplier', basisPoints: 30000 } }),
    ];
    const result = calculate(regularShift, rules, { holidayIntervals: [{ id: 'h', name: 'Holiday', start: regularShift.scheduledStart!, end: regularShift.scheduledEnd! }] });
    expect(result.segments[0]).toMatchObject({ baseHourlyRateMinor: 8000, multiplierBasisPoints: 15000 });
  });

  it('splits per-shift and prior daily overtime thresholds', () => {
    const threshold = createPayRule({ id: 'overtime', conditions: [{ type: 'workedMinutes', afterMinutes: 480, scope: 'day' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const result = calculate(regularShift, [threshold], { priorWorkedMinutesByLocalDate: { '2026-07-15': 300 } });
    expect(result.segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[180, 10000], [300, 12500]]);
  });

  it('reports missing configuration without a false zero total', () => {
    const result = calculateSalary({ shift: regularShift, rules: [], breaks: [], holidayIntervals: [], calculatedAt });
    expect(result.totalGrossPayMinor).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'missing_hourly_rate', severity: 'error' }));
  });

  it('supports active provisional calculations and stable explanation output', () => {
    const active = createShift({ status: 'active', actualStart: '2026-07-15T08:00:00+03:00', actualEnd: undefined, activeOrigin: 'scheduled', hourlyRateSnapshotMinor: 0 });
    const result = calculateSalary({ shift: active, profile, rules: [], breaks: [], holidayIntervals: [], activeEnd: '2026-07-15T10:30:00+03:00', calculatedAt });
    expect(result).toMatchObject({ context: 'active_provisional', payableMinutes: 150, totalGrossPayMinor: 15000 });
    expect(result.explanations.length).toBeGreaterThan(1);
  });

  it('handles DST instants without one-minute iteration', () => {
    const shift = createShift({ scheduledStart: '2026-10-25T00:30:00+03:00', scheduledEnd: '2026-10-25T02:30:00+02:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    expect(calculate(shift).payableMinutes).toBe(180);
  });

  it('splits holiday and unpaid-break boundaries without paying the break', () => {
    const holiday = createPayRule({ id: 'holiday-part', conditions: [{ type: 'holiday' }], effect: { type: 'multiplier', basisPoints: 15000 } });
    const shift = createShift({ scheduledStart: regularShift.scheduledStart, scheduledEnd: regularShift.scheduledEnd, expectedBreakMinutes: 30, hourlyRateSnapshotMinor: 0 });
    const result = calculate(shift, [holiday], { breaks: [createBreak({ start: '2026-07-15T11:30:00+03:00', end: '2026-07-15T12:00:00+03:00' })], holidayIntervals: [{ id: 'half-day', name: 'Holiday', start: '2026-07-15T12:00:00+03:00', end: '2026-07-15T16:00:00+03:00' }] });
    expect(result.unpaidBreakMinutes).toBe(30);
    expect(result.segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[210, 10000], [240, 15000]]);
  });

  it('applies a rule only on local dates inside its effective range', () => {
    const twoDays = createShift({ scheduledStart: '2026-07-15T23:00:00+03:00', scheduledEnd: '2026-07-16T02:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const expires = createPayRule({ id: 'expires', effectiveTo: '2026-07-15', effect: { type: 'multiplier', basisPoints: 15000 } });
    expect(calculate(twoDays, [expires]).segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[60, 15000], [120, 10000]]);
  });

  it('splits a configurable weekend boundary', () => {
    const shift = createShift({ scheduledStart: '2026-07-17T17:00:00+03:00', scheduledEnd: '2026-07-17T19:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const weekend = createPayRule({ id: 'weekend-window', conditions: [{ type: 'weekend', startWeekday: 5, startTime: '18:00', endWeekday: 6, endTime: '18:00' }], effect: { type: 'multiplier', basisPoints: 15000 } });
    expect(calculate(shift, [weekend]).segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[60, 10000], [60, 15000]]);
  });

  it('conserves minutes when a rule boundary splits second-bearing timestamps', () => {
    const shift = createShift({ scheduledStart: '2026-07-15T20:00:30+03:00', scheduledEnd: '2026-07-15T22:00:30+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const night = createPayRule({ id: 'night-seconds', conditions: [{ type: 'timeWindow', startTime: '22:00', endTime: '06:00' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const result = calculate(shift, [night]);
    expect(result.grossMinutes).toBe(120);
    expect(result.payableMinutes).toBe(120);
    expect(result.segments.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(120);
  });

  it('rounds cumulative rational pay independently of equivalent-rate boundaries', () => {
    const tinyProfile = createSalaryProfile({ baseHourlyRateMinor: 1 });
    const shift = createShift({ scheduledStart: '2026-07-15T23:30:00+03:00', scheduledEnd: '2026-07-16T00:30:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const result = calculateSalary({ shift, profile: tinyProfile, rules: [], breaks: [], holidayIntervals: [], calculatedAt });
    expect(result.segments).toHaveLength(2);
    expect(result.segments.reduce((sum, segment) => sum + segment.totalPayMinor, 0)).toBe(1);
    expect(result.totalGrossPayMinor).toBe(1);
  });

  it('honors gross and net worked-minute threshold bases separately', () => {
    const shift = createShift({ scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T14:00:00+03:00', expectedBreakMinutes: 60, hourlyRateSnapshotMinor: 0 });
    const breakSession = createBreak({ start: '2026-07-15T10:00:00+03:00', end: '2026-07-15T11:00:00+03:00' });
    const makeThreshold = (basis: 'gross' | 'net') => createPayRule({ id: `threshold-${basis}`, conditions: [{ type: 'workedMinutes', afterMinutes: 180, scope: 'shift', basis }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const gross = calculate(shift, [makeThreshold('gross')], { breaks: [breakSession] });
    const net = calculate(shift, [makeThreshold('net')], { breaks: [breakSession] });
    expect(gross.specialRateMinutes).toBe(180);
    expect(net.specialRateMinutes).toBe(120);
  });

  it('uses the date-specific resolved rate for a minimum-duration adjustment', () => {
    const shift = createShift({ scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T09:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const result = calculate(shift, [
      createPayRule({ id: 'rate', priority: 100, conditions: [{ type: 'date', date: '2026-07-15' }], effect: { type: 'rateOverride', hourlyRateMinor: 12000 } }),
      createPayRule({ id: 'minimum-date', effect: { type: 'minimumPaidDuration', minutes: 120 } }),
    ]);
    expect(result.minimumDurationAdjustmentMinor).toBe(12000);
    expect(result.totalGrossPayMinor).toBe(24000);
  });

  it('rejects an active provisional range whose expected end has already passed', () => {
    const active = createShift({ status: 'active', actualStart: '2026-07-15T22:10:00+03:00', scheduledEnd: '2026-07-15T22:00:00+03:00', activeOrigin: 'scheduled', hourlyRateSnapshotMinor: 0 });
    expect(() => calculateSalary({ shift: active, profile, rules: [], breaks: [], holidayIntervals: [], activeEnd: active.scheduledEnd, calculatedAt })).toThrow('after');
  });
});
