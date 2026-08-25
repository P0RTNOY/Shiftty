import { calculateMonthlyEarnings } from '@/domain/services/salary-forecast-service';
import { createCalendarEvidenceInterval, createPayRule, createSalaryProfile, createShift, createWeeklyRestSchedule } from '@/test/fixtures';

it('separates earned, future, forecast and incomplete calculations', () => {
  const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
  const completed = createShift({ id: 'done', status: 'completed', actualStart: '2026-07-01T08:00:00+03:00', actualEnd: '2026-07-01T10:00:00+03:00', payableStart: '2026-07-01T08:00:00+03:00', payableEnd: '2026-07-01T10:00:00+03:00', payableSource: 'actual', payableBreakMinutes: 0, completedAt: '2026-07-01T10:00:00+03:00', hourlyRateSnapshotMinor: 6000 });
  const future = createShift({ id: 'future', scheduledStart: '2026-07-02T08:00:00+03:00', scheduledEnd: '2026-07-02T10:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
  const missing = createShift({ id: 'missing', workplaceId: 'other', scheduledStart: '2026-07-03T08:00:00+03:00', scheduledEnd: '2026-07-03T10:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
  const summary = calculateMonthlyEarnings([completed, future, missing], { profilesByWorkplace: { 'workplace-1': profile }, rulesByProfile: {}, rolesById: {}, workplacesById: {}, calculatedAt: '2026-07-01T12:00:00+03:00' });
  expect(summary).toMatchObject({ earnedMinor: 12000, futureMinor: 12000, forecastMinor: 24000, incompleteShiftCount: 1, regularMinutes: 240, specialRateMinutes: 0 });
});

it('applies daily accumulated thresholds to a later scheduled shift', () => {
  const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
  const first = createShift({ id: 'first', scheduledStart: '2026-07-02T08:00:00+03:00', scheduledEnd: '2026-07-02T10:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
  const second = createShift({ id: 'second', scheduledStart: '2026-07-02T11:00:00+03:00', scheduledEnd: '2026-07-02T13:00:00+03:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
  const threshold = createPayRule({ id: 'daily', conditions: [{ type: 'workedMinutes', afterMinutes: 180, scope: 'day' }], effect: { type: 'multiplier', basisPoints: 12500 } });
  const summary = calculateMonthlyEarnings([second, first], { profilesByWorkplace: { 'workplace-1': profile }, rulesByProfile: { [profile.id]: [threshold] }, rolesById: {}, workplacesById: {}, calculatedAt: '2026-07-01T12:00:00+03:00' });
  expect(summary.resultsByShiftId.second!.segments.map((item) => [item.minutes, item.multiplierBasisPoints])).toEqual([[60, 10000], [60, 12500]]);
  expect(summary).toMatchObject({ regularMinutes: 180, specialRateMinutes: 60 });
});

it('applies profile-compatible evidence while an interval without a matching rule has no pay effect', () => {
  const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
  const shift = createShift({
    scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T12:00:00+03:00',
    expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
  });
  const holiday = createCalendarEvidenceInterval({
    id: 'forecast-holiday', start: '2026-07-15T09:00:00+03:00', end: '2026-07-15T11:00:00+03:00',
  });
  const custom = createCalendarEvidenceInterval({
    id: 'forecast-custom', type: 'custom', start: '2026-07-15T10:00:00+03:00', end: '2026-07-15T10:30:00+03:00',
  });
  const foreign = createCalendarEvidenceInterval({
    id: 'foreign-profile', salaryProfileId: 'other-profile', start: shift.scheduledStart!, end: shift.scheduledEnd!,
  });
  const rule = createPayRule({
    id: 'forecast-holiday-rate', premiumFamily: 'special_interval',
    conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
    effect: { type: 'multiplier', basisPoints: 15000 },
  });

  const summary = calculateMonthlyEarnings([shift], {
    profilesByWorkplace: { [shift.workplaceId]: profile },
    rulesByProfile: { [profile.id]: [rule] },
    rolesById: {}, workplacesById: {},
    specialIntervalsByWorkplace: { [shift.workplaceId]: [custom, foreign, holiday] },
    calculatedAt: '2026-07-15T12:00:00+03:00',
  });

  expect(summary.futureMinor).toBe(30000);
  expect(summary.resultsByShiftId[shift.id]?.specialIntervalEvaluations?.map((item) => [item.intervalId, item.contributedToEstimate])).toEqual([
    ['forecast-holiday', true], ['forecast-custom', false],
  ]);
});

it('resolves a bounded recurring weekly-rest occurrence for salary forecasting', () => {
  const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
  const shift = createShift({
    scheduledStart: '2026-07-17T08:00:00+03:00', scheduledEnd: '2026-07-17T12:00:00+03:00',
    expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0,
  });
  const schedule = createWeeklyRestSchedule({
    startWeekday: 5, startTime: '09:00', endWeekday: 5, endTime: '11:00', enabled: true,
    confirmedAt: '2026-07-01T10:00:00+03:00',
  });
  const rule = createPayRule({
    id: 'forecast-rest-rate', premiumFamily: 'special_interval',
    conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
    effect: { type: 'multiplier', basisPoints: 15000 },
  });

  const summary = calculateMonthlyEarnings([shift], {
    profilesByWorkplace: { [shift.workplaceId]: profile },
    rulesByProfile: { [profile.id]: [rule] },
    rolesById: {}, workplacesById: {},
    weeklyRestSchedulesByProfile: { [profile.id]: schedule },
    calculatedAt: '2026-07-17T12:00:00+03:00',
  });

  expect(summary.futureMinor).toBe(30000);
  expect(summary.resultsByShiftId[shift.id]?.specialIntervalEvaluations).toEqual([
    expect.objectContaining({ type: 'weekly_rest', contributedToEstimate: true }),
  ]);
});
