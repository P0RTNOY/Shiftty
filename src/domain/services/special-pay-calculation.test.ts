import { payCalculationResultSchema } from '@/domain/entities';
import { calculateSalary, deriveSalaryTrustState } from '@/domain/services';
import { createCalendarEvidenceInterval, createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';

const profile = createSalaryProfile({ baseHourlyRateMinor: 6_000 });
const shift = createShift({
  scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T12:00:00+03:00',
  expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
});
const holiday = createCalendarEvidenceInterval({ start: '2026-07-15T09:00:00+03:00', end: '2026-07-15T11:00:00+03:00' });
const calculate = (rules = [] as ReturnType<typeof createPayRule>[], specialIntervals = [holiday], extra = {}) => calculateSalary({
  shift, profile, rules, breaks: [], holidayIntervals: [], specialIntervals, calculatedAt: '2026-07-15T12:00:00+03:00', ...extra,
});
const specialRule = (overrides = {}) => createPayRule({
  id: 'holiday-pay', name: 'Configured holiday pay', premiumFamily: 'special_interval',
  conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
  effect: { type: 'multiplier', basisPoints: 15_000 }, ...overrides,
});

describe('special-interval salary calculation', () => {
  it('splits both evidence boundaries but changes no money without a pay rule', () => {
    const result = calculate();
    expect(result.segments.map((segment) => [segment.start, segment.end, segment.minutes, segment.multiplierBasisPoints])).toEqual([
      ['2026-07-15T05:00:00.000Z', '2026-07-15T06:00:00.000Z', 60, 10_000],
      ['2026-07-15T06:00:00.000Z', '2026-07-15T08:00:00.000Z', 120, 10_000],
      ['2026-07-15T08:00:00.000Z', '2026-07-15T09:00:00.000Z', 60, 10_000],
    ]);
    expect(result).toMatchObject({ basePayMinor: 24_000, premiumPayMinor: 0, totalGrossPayMinor: 24_000 });
    expect(result.specialIntervalEvaluations).toEqual([
      expect.objectContaining({ intervalId: holiday.id, appliedRuleIds: [], contributedToEstimate: false }),
    ]);
    expect(deriveSalaryTrustState(result)).toBe('basic_estimate');
  });

  it('applies a configured holiday multiplier with frozen evidence provenance', () => {
    const result = calculate([specialRule()]);
    expect(result.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([
      [60, 10_000], [120, 15_000], [60, 10_000],
    ]);
    expect(result).toMatchObject({ basePayMinor: 24_000, premiumPayMinor: 6_000, totalGrossPayMinor: 30_000, engineVersion: '1.6.0' });
    expect(result.specialIntervalEvaluations).toEqual([
      expect.objectContaining({ intervalId: holiday.id, type: 'holiday', start: expect.any(String), end: expect.any(String), appliedRuleIds: ['holiday-pay'], contributedToEstimate: true }),
    ]);
    expect(result.segments[1]?.specialIntervalIds).toEqual([holiday.id]);
    expect(deriveSalaryTrustState(result)).toBe('configured_estimate');
    expect(payCalculationResultSchema.parse(JSON.parse(JSON.stringify(result))).specialIntervalEvaluations?.[0])
      .toMatchObject({ name: 'Configured holiday', appliedRuleIds: ['holiday-pay'] });
  });

  it('supports the legacy holiday condition against new holiday evidence', () => {
    const legacy = createPayRule({ id: 'legacy-holiday', conditions: [{ type: 'holiday' }], effect: { type: 'multiplier', basisPoints: 15_000 } });
    expect(calculate([legacy]).totalGrossPayMinor).toBe(30_000);
  });

  it('chooses the strongest non-stacking special rule regardless of priority', () => {
    const rest = createCalendarEvidenceInterval({ id: 'rest', type: 'weekly_rest', name: 'Weekly rest' });
    const weakerHighPriority = specialRule({ priority: 100, effect: { type: 'multiplier', basisPoints: 15_000 } });
    const strongerLowPriority = specialRule({ id: 'rest-pay', priority: 0, conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }], effect: { type: 'multiplier', basisPoints: 17_500 } });
    const result = calculate([weakerHighPriority, strongerLowPriority], [holiday, rest]);
    expect(result.segments[1]?.multiplierBasisPoints).toBe(17_500);
    expect(result.segments[1]?.appliedRuleIds).toEqual(['rest-pay']);
  });

  it('adds an explicitly stacking special premium above the non-stacking result', () => {
    const rest = createCalendarEvidenceInterval({ id: 'rest', type: 'weekly_rest', name: 'Weekly rest' });
    const restStacking = specialRule({ id: 'rest-pay', canStack: true, conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }], effect: { type: 'multiplier', basisPoints: 12_500 } });
    const result = calculate([specialRule(), restStacking], [holiday, rest]);
    expect(result.segments[1]?.multiplierBasisPoints).toBe(17_500);
    expect(result.specialIntervalEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({ intervalId: holiday.id, appliedRuleIds: ['holiday-pay'] }),
      expect.objectContaining({ intervalId: rest.id, appliedRuleIds: ['rest-pay'] }),
    ]));
  });

  it('combines holiday pay with daily overtime without duplicating overtime', () => {
    const overtime = createPayRule({
      id: 'daily-overtime', canStack: true, premiumFamily: 'overtime',
      conditions: [{ type: 'workedMinutes', afterMinutes: 480, scope: 'day', basis: 'net' }],
      effect: { type: 'multiplier', basisPoints: 12_500 },
    });
    const twoHours = createShift({ ...shift, scheduledEnd: '2026-07-15T10:00:00+03:00' });
    const fullHoliday = createCalendarEvidenceInterval({ ...holiday, start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T10:00:00+03:00' });
    const result = calculateSalary({
      shift: twoHours, profile, rules: [specialRule(), overtime], breaks: [], holidayIntervals: [], specialIntervals: [fullHoliday],
      priorWorkedMinutesByLocalDate: { '2026-07-15': 450 }, calculatedAt: '2026-07-15T10:00:00+03:00',
    });
    expect(result.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([[30, 15_000], [90, 17_500]]);
    expect(result).toMatchObject({ basePayMinor: 12_000, premiumPayMinor: 8_250, totalGrossPayMinor: 20_250 });
  });

  it('combines weekly rest with weekly overtime using one overtime premium', () => {
    const twoHours = createShift({ ...shift, scheduledEnd: '2026-07-15T10:00:00+03:00' });
    const rest = createCalendarEvidenceInterval({ ...holiday, type: 'weekly_rest', name: 'Weekly rest', start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T10:00:00+03:00' });
    const restPay = specialRule({ id: 'rest-pay', conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }] });
    const weeklyOvertime = createPayRule({
      id: 'weekly-overtime', canStack: true, premiumFamily: 'overtime',
      conditions: [{ type: 'workedMinutes', afterMinutes: 120, scope: 'week', basis: 'net' }],
      effect: { type: 'multiplier', basisPoints: 12_500 },
    });
    const result = calculateSalary({
      shift: twoHours, profile, rules: [restPay, weeklyOvertime], breaks: [], holidayIntervals: [], specialIntervals: [rest],
      priorWorkedMinutesByWorkweek: { '2026-07-12': 60 }, calculatedAt: '2026-07-15T10:00:00+03:00',
    });
    expect(result.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints])).toEqual([[60, 15_000], [60, 17_500]]);
    expect(result).toMatchObject({ basePayMinor: 12_000, premiumPayMinor: 7_500, totalGrossPayMinor: 19_500 });
  });

  it('evaluates a manually confirmed weekly-rest interval without recurring-schedule provenance', () => {
    const twoHours = createShift({ ...shift, scheduledEnd: '2026-07-15T10:00:00+03:00' });
    const manualRest = createCalendarEvidenceInterval({
      id: 'manual-rest', type: 'weekly_rest', name: 'My one-time rest interval',
      start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T10:00:00+03:00',
      sourceKind: 'manual',
    });
    const restPay = specialRule({
      id: 'manual-rest-pay',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
    });

    const result = calculateSalary({
      shift: twoHours, profile, rules: [restPay], breaks: [], holidayIntervals: [],
      specialIntervals: [manualRest], calculatedAt: '2026-07-15T10:00:00+03:00',
    });

    expect(result.segments).toEqual([expect.objectContaining({
      start: '2026-07-15T05:00:00.000Z', end: '2026-07-15T07:00:00.000Z',
      minutes: 120, multiplierBasisPoints: 15_000, totalPayMinor: 18_000,
    })]);
    expect(result).toMatchObject({ basePayMinor: 12_000, premiumPayMinor: 6_000, totalGrossPayMinor: 18_000 });
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      intervalId: 'manual-rest', type: 'weekly_rest', sourceKind: 'manual',
      start: manualRest.start, end: manualRest.end, appliedRuleIds: ['manual-rest-pay'],
      contributedToEstimate: true,
    })]);
    expect(result.specialIntervalEvaluations?.[0]?.scheduleId).toBeUndefined();
  });

  it('retains shift-type composition with special pay and overtime', () => {
    const typed = createShift({ ...shift, scheduledEnd: '2026-07-15T09:00:00+03:00', shiftTypeNameSnapshot: 'Night', shiftTypePayMultiplierBasisPoints: 15_000 });
    const fullHoliday = createCalendarEvidenceInterval({ ...holiday, start: '2026-07-15T08:00:00+03:00', end: '2026-07-15T09:00:00+03:00' });
    const overtime = createPayRule({ id: 'overtime', canStack: true, premiumFamily: 'overtime', conditions: [{ type: 'workedMinutes', afterMinutes: 0, scope: 'shift' }], effect: { type: 'multiplier', basisPoints: 12_500 } });
    const result = calculateSalary({ shift: typed, profile, rules: [specialRule({ effect: { type: 'multiplier', basisPoints: 17_500 } }), overtime], breaks: [], holidayIntervals: [], specialIntervals: [fullHoliday], calculatedAt: '2026-07-15T09:00:00+03:00' });
    expect(result.segments).toEqual([expect.objectContaining({ minutes: 60, multiplierBasisPoints: 20_000, totalPayMinor: 12_000 })]);
  });

  it('does not attribute a losing special multiplier against a stronger shift-type baseline', () => {
    const typed = createShift({
      ...shift,
      scheduledEnd: '2026-07-15T09:00:00+03:00',
      shiftTypeNameSnapshot: 'Night',
      shiftTypePayMultiplierBasisPoints: 17_500,
    });
    const fullHoliday = createCalendarEvidenceInterval({
      ...holiday,
      start: '2026-07-15T08:00:00+03:00',
      end: '2026-07-15T09:00:00+03:00',
    });
    const result = calculateSalary({
      shift: typed,
      profile,
      rules: [specialRule()],
      breaks: [],
      holidayIntervals: [],
      specialIntervals: [fullHoliday],
      calculatedAt: '2026-07-15T09:00:00+03:00',
    });

    expect(result.segments).toEqual([expect.objectContaining({
      minutes: 60,
      multiplierBasisPoints: 17_500,
      totalPayMinor: 10_500,
      appliedRuleIds: ['holiday-pay'],
    })]);
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['holiday-pay'],
      contributedToEstimate: false,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('basic_estimate');
  });

  it('attributes an equivalent non-stacking special-rule cohort when removing the cohort changes pay', () => {
    const primary = specialRule({ priority: 10 });
    const fallback = specialRule({ id: 'holiday-pay-fallback', priority: 0 });
    const result = calculate([fallback, primary]);

    expect(result).toMatchObject({ premiumPayMinor: 6_000, totalGrossPayMinor: 30_000 });
    expect(result.segments[1]).toEqual(expect.objectContaining({
      multiplierBasisPoints: 15_000,
      appliedRuleIds: ['holiday-pay'],
    }));
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['holiday-pay'],
      contributedToEstimate: true,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('configured_estimate');
  });

  it('attributes equivalent special rate overrides as one applicable cohort', () => {
    const primary = createPayRule({
      id: 'holiday-rate-primary',
      priority: 10,
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'rateOverride', hourlyRateMinor: 7_000 },
    });
    const fallback = createPayRule({
      id: 'holiday-rate-fallback',
      priority: 0,
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'rateOverride', hourlyRateMinor: 7_000 },
    });
    const result = calculate([fallback, primary]);

    expect(result).toMatchObject({ basePayMinor: 26_000, totalGrossPayMinor: 26_000 });
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['holiday-rate-primary'],
      contributedToEstimate: true,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('configured_estimate');
  });

  it('does not attribute a stacking multiplier with no premium above 100%', () => {
    const noEffectPremium = specialRule({
      id: 'zero-premium',
      canStack: true,
      effect: { type: 'multiplier', basisPoints: 10_000 },
    });
    const result = calculate([noEffectPremium]);

    expect(result.totalGrossPayMinor).toBe(24_000);
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['zero-premium'],
      contributedToEstimate: false,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('basic_estimate');
  });

  it.each([
    ['zero fixed bonus', createPayRule({
      id: 'zero-bonus',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'fixedBonus', amountMinor: 0 },
    })],
    ['equal rate override', createPayRule({
      id: 'equal-rate',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'rateOverride', hourlyRateMinor: 6_000 },
    })],
    ['satisfied minimum duration', createPayRule({
      id: 'satisfied-minimum',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'minimumPaidDuration', minutes: 180 },
    })],
  ])('does not attribute a matched %s rule that changes no monetary component', (_name, rule) => {
    const result = calculate([rule]);

    expect(result.totalGrossPayMinor).toBe(24_000);
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: [rule.id],
      contributedToEstimate: false,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('basic_estimate');
  });

  it('does not attribute a fixed component suppressed by a shift override', () => {
    const overriddenShift = createShift({ ...shift, fixedBonusOverrideMinor: 900 });
    const suppressedBonus = createPayRule({
      id: 'suppressed-bonus',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'fixedBonus', amountMinor: 500 },
    });
    const result = calculateSalary({
      shift: overriddenShift,
      profile,
      rules: [suppressedBonus],
      breaks: [],
      holidayIntervals: [],
      specialIntervals: [holiday],
      calculatedAt: '2026-07-15T12:00:00+03:00',
    });

    expect(result).toMatchObject({ fixedBonusesMinor: 900, totalGrossPayMinor: 24_900 });
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['suppressed-bonus'],
      contributedToEstimate: false,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('basic_estimate');
  });

  it('attributes redundant minimum-duration rules when their cohort adds an adjustment', () => {
    const primary = createPayRule({
      id: 'holiday-minimum-primary',
      priority: 10,
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'minimumPaidDuration', minutes: 300 },
    });
    const fallback = createPayRule({
      id: 'holiday-minimum-fallback',
      priority: 0,
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'minimumPaidDuration', minutes: 300 },
    });
    const result = calculate([fallback, primary]);

    expect(result).toMatchObject({
      minimumDurationAdjustmentMinutes: 60,
      minimumDurationAdjustmentMinor: 6_000,
      totalGrossPayMinor: 30_000,
    });
    expect(result.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['holiday-minimum-fallback', 'holiday-minimum-primary'],
      contributedToEstimate: true,
    })]);
    expect(deriveSalaryTrustState(result)).toBe('configured_estimate');
  });

  it('is rule-order independent and applies fixed components once', () => {
    const bonus = createPayRule({ id: 'special-bonus', premiumFamily: undefined, conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }], effect: { type: 'fixedBonus', amountMinor: 900 } });
    const reimbursement = createPayRule({ id: 'special-reimbursement', premiumFamily: undefined, conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }], effect: { type: 'reimbursement', amountMinor: 1_200 } });
    const minimum = createPayRule({ id: 'special-minimum', premiumFamily: undefined, conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }], effect: { type: 'minimumPaidDuration', minutes: 300 } });
    const rules = [specialRule(), bonus, reimbursement, minimum];
    const left = calculate(rules);
    const right = calculate([...rules].reverse());
    expect(right.segments).toEqual(left.segments);
    expect(right.specialIntervalEvaluations).toEqual(left.specialIntervalEvaluations);
    expect(left).toMatchObject({
      fixedBonusesMinor: 900,
      reimbursementsMinor: 1_200,
      minimumDurationAdjustmentMinutes: 60,
      minimumDurationAdjustmentMinor: 6_000,
      totalGrossPayMinor: 38_100,
    });
    expect(left.specialIntervalEvaluations).toEqual([expect.objectContaining({
      appliedRuleIds: ['holiday-pay', 'special-bonus', 'special-minimum', 'special-reimbursement'],
      contributedToEstimate: true,
    })]);
    expect(deriveSalaryTrustState(left)).toBe('configured_estimate');
  });

  it('applies one custom rule once when two custom evidence intervals overlap', () => {
    const first = createCalendarEvidenceInterval({ id: 'custom-a', type: 'custom', name: 'Custom A' });
    const second = createCalendarEvidenceInterval({ id: 'custom-b', type: 'custom', name: 'Custom B', start: '2026-07-15T10:00:00+03:00', end: '2026-07-15T12:00:00+03:00' });
    const customPay = specialRule({ id: 'custom-pay', canStack: true, conditions: [{ type: 'specialInterval', intervalTypes: ['custom'] }], effect: { type: 'multiplier', basisPoints: 12_500 } });
    const result = calculate([customPay], [second, first]);
    expect(result.segments.map((segment) => [segment.minutes, segment.multiplierBasisPoints, segment.appliedRuleIds])).toEqual([
      [60, 10_000, []], [60, 12_500, ['custom-pay']], [60, 12_500, ['custom-pay']], [60, 12_500, ['custom-pay']],
    ]);
    expect(result.segments[2]?.specialIntervalIds).toEqual(['custom-a', 'custom-b']);
  });

  it('ignores evidence from another workplace or profile', () => {
    const foreign = createCalendarEvidenceInterval({ workplaceId: 'workplace-2', salaryProfileId: 'profile-2' });
    const result = calculate([specialRule()], [foreign]);
    expect(result.totalGrossPayMinor).toBe(24_000);
    expect(result.specialIntervalEvaluations).toBeUndefined();
  });
});
