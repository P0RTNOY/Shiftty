import { calculateMonthlyEarnings } from '@/domain/services/salary-forecast-service';
import { createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';

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
