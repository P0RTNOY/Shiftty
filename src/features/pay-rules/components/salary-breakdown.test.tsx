import { fireEvent, screen } from '@testing-library/react-native';

import { calculateSalary } from '@/domain/services';
import { SalaryBreakdown } from '@/features/pay-rules/components/salary-breakdown';
import { createCalendarEvidenceInterval, createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const result = calculateSalary({
  shift: createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, shiftTypeNameSnapshot: 'לילה', shiftTypePayMultiplierBasisPoints: 15_000 }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [],
  breaks: [],
  holidayIntervals: [],
  calculatedAt: '2026-07-15T22:00:00+03:00',
});

const tieredResult = calculateSalary({
  shift: createShift({
    scheduledStart: '2026-07-15T08:00:00+03:00',
    scheduledEnd: '2026-07-15T20:00:00+03:00',
    expectedBreakMinutes: 0,
    hourlyRateSnapshotMinor: 0,
  }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [],
  breaks: [],
  holidayIntervals: [],
  calculatedAt: '2026-07-15T20:00:00+03:00',
});

const overLimitResult = calculateSalary({
  shift: createShift({
    scheduledStart: '2026-07-15T08:00:00+03:00',
    scheduledEnd: '2026-07-15T20:01:00+03:00',
    expectedBreakMinutes: 0,
    hourlyRateSnapshotMinor: 0,
  }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [], breaks: [], holidayIntervals: [], calculatedAt: '2026-07-15T20:01:00+03:00',
});

const weeklyRestOvertimeResult = calculateSalary({
  shift: createShift({
    scheduledStart: '2026-08-29T17:30:00+03:00',
    scheduledEnd: '2026-08-30T05:30:00+03:00',
    expectedBreakMinutes: 0,
    hourlyRateSnapshotMinor: 0,
  }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [createPayRule({
    id: 'weekly-rest-rate',
    premiumFamily: 'special_interval',
    conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
    effect: { type: 'multiplier', basisPoints: 15_000 },
  })],
  breaks: [],
  holidayIntervals: [],
  specialIntervals: [createCalendarEvidenceInterval({
    id: 'weekly-rest-occurrence',
    type: 'weekly_rest',
    start: '2026-08-28T18:00:00+03:00',
    end: '2026-08-30T18:00:00+03:00',
  })],
  calculatedAt: '2026-08-29T17:00:00+03:00',
});

it('shows a simple salary estimate and discloses calculation details on request', () => {
  renderApp(<SalaryBreakdown result={result} status="estimated" />);

  expect(screen.getByText('שכר משוער')).toBeTruthy();
  expect(screen.getByText('לילה')).toBeTruthy();
  expect(screen.getByText('150%')).toBeTruthy();
  expect(screen.getByText('תעריף שעתי בסיסי')).toBeTruthy();
  expect(screen.getByText('תעריף שעתי לפי סוג')).toBeTruthy();
  expect(screen.getByText(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result.totalGrossPayMinor! / 100))).toBeTruthy();
  expect(screen.queryByText('שכר בסיס')).toBeNull();
  expect(screen.queryByText(/1\.0\.0/)).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'פירוט סכומים' }));
  expect(screen.getByText('שכר בסיס')).toBeTruthy();
  expect(screen.getByLabelText('הערכה בסיסית')).toBeTruthy();
  expect(screen.queryByText(/1\.0\.0/)).toBeNull();
  expect(screen.queryByText(/2026-07-15T22:00:00/)).toBeNull();
});

it('keeps stale and missing salary warnings visible without disclosure', () => {
  const { unmount } = renderApp(<SalaryBreakdown result={result} status="stale" />);
  expect(screen.getAllByText('החישוב אינו מעודכן')).toHaveLength(1);
  expect(screen.queryByText('הערכת השכר אינה זמינה')).toBeNull();
  expect(screen.queryByText('החישוב מבוסס על הגדרות השכר שהזנת.')).toBeNull();
  expect(screen.queryByText(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result.totalGrossPayMinor! / 100))).toBeNull();
  unmount();

  renderApp(<SalaryBreakdown onRecalculate={jest.fn()} status="estimated" />);
  expect(screen.getAllByText('הערכת השכר אינה זמינה')).toHaveLength(1);
  expect(screen.getByRole('alert', { name: 'הערכת השכר אינה זמינה' })).toBeTruthy();
  expect(screen.queryByText('החישוב מבוסס על הגדרות השכר שהזנת.')).toBeNull();
  expect(screen.queryByTestId('e2e-salary-total')).toBeNull();
});

it('labels the 125% and 150% overtime tiers in the Hebrew breakdown', () => {
  renderApp(<SalaryBreakdown result={tieredResult} status="estimated" />);

  expect(screen.getByText(/8 שעות × 100%.*2 שעות × 125%.*2 שעות × 150%/)).toBeTruthy();
  expect(screen.getByText('חלוקה לפי תעריפים')).toBeTruthy();
  expect(screen.getByText('תוספות שעות')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'פירוט סכומים' }));

  expect(screen.getByText(/שעות נוספות 125%/)).toBeTruthy();
  expect(screen.getByText(/שעות נוספות 150%/)).toBeTruthy();
});

it('labels weekly overtime segments with their configured threshold and multiplier', () => {
  const weeklyResult = {
    ...tieredResult,
    explanations: [
      ...tieredResult.explanations,
      'salary.explanations.weekly_overtime:system-weekly-overtime:profile-1:2520:12500:net',
    ],
    segments: tieredResult.segments.map((segment, index) => index === tieredResult.segments.length - 1
      ? { ...segment, labels: ['salary.weeklyOvertimeRuleName'] }
      : segment),
  };
  renderApp(<SalaryBreakdown result={weeklyResult} status="estimated" />);
  fireEvent.press(screen.getByRole('button', { name: 'פירוט סכומים' }));

  expect(screen.getByText(/שעות נוספות שבועיות אחרי 42 שעות · 125%/)).toBeTruthy();
});

it('shows the combined weekly-rest and overtime tiers before expanding the details', () => {
  renderApp(<SalaryBreakdown result={weeklyRestOvertimeResult} status="estimated" />);

  expect(screen.getByTestId('e2e-salary-total').props.accessibilityLabel).toBe('117000');
  expect(screen.getByText(/8 שעות × 150%.*2 שעות × 175%.*2 שעות × 200%/)).toBeTruthy();
});

it('shows frozen evidence names on the exact salary segments they overlap', () => {
  const evidenceResult = {
    ...result,
    specialIntervalEvaluations: [{
      intervalId: 'holiday-1',
      type: 'holiday' as const,
      name: 'חג שאושר',
      start: result.segments[0]!.start,
      end: result.segments[0]!.end,
      timezone: result.calculationTimezone,
      sourceKind: 'manual' as const,
      confirmedAt: '2026-07-14T10:00:00+03:00',
      appliedRuleIds: ['holiday-rule'],
      contributedToEstimate: true,
    }],
    segments: result.segments.map((segment, index) => index === 0
      ? { ...segment, appliedRuleIds: [...segment.appliedRuleIds, 'holiday-rule'], specialIntervalIds: ['holiday-1'] }
      : segment),
  };
  renderApp(<SalaryBreakdown result={evidenceResult} status="finalized" />);
  fireEvent.press(screen.getByRole('button', { name: 'פירוט סכומים' }));

  expect(screen.getByTestId('salary-segment-special-intervals')).toHaveTextContent('חג שאושר');
});

it('keeps a legitimate finalized zero numeric', () => {
  const zeroResult = { ...result, totalGrossPayMinor: 0 };
  renderApp(<SalaryBreakdown result={zeroResult} status="finalized" />);

  expect(screen.getByText(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0))).toBeTruthy();
  expect(screen.queryByText('חישוב שכר חסר')).toBeNull();
});

it('explains why compensation is unavailable for an over-limit recovery record', () => {
  renderApp(<SalaryBreakdown result={overLimitResult} status="estimated" />);

  expect(screen.getByText('משך המשמרת חורג מהמקסימום המותר של 12 שעות.')).toBeTruthy();
});

it('offers an immediate recalculation for a legacy base-only snapshot', () => {
  const onRecalculate = jest.fn();
  const legacy = {
    ...result,
    issues: [{ code: 'no_pay_rules_configured', severity: 'warning' as const, messageKey: 'salary.noPayRules' }],
  };

  renderApp(<SalaryBreakdown onRecalculate={onRecalculate} result={legacy} status="finalized" />);

  fireEvent.press(screen.getByRole('button', { name: 'החלת ברירת המחדל לשעות נוספות' }));
  expect(onRecalculate).toHaveBeenCalledTimes(1);
});
