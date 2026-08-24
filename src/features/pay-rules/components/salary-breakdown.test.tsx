import { fireEvent, screen } from '@testing-library/react-native';

import { calculateSalary } from '@/domain/services';
import { SalaryBreakdown } from '@/features/pay-rules/components/salary-breakdown';
import { createSalaryProfile, createShift } from '@/test/fixtures';
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

  fireEvent.press(screen.getByRole('button', { name: 'פירוט שכר' }));
  expect(screen.getByText('שכר בסיס')).toBeTruthy();
  expect(screen.getByLabelText('הערכה בלבד')).toBeTruthy();
  expect(screen.queryByText(/1\.0\.0/)).toBeNull();
  expect(screen.queryByText(/2026-07-15T22:00:00/)).toBeNull();
});

it('keeps stale and missing salary warnings visible without disclosure', () => {
  const { unmount } = renderApp(<SalaryBreakdown result={result} status="stale" />);
  expect(screen.getByText('החישוב אינו מעודכן')).toBeTruthy();
  unmount();

  renderApp(<SalaryBreakdown onRecalculate={jest.fn()} status="estimated" />);
  expect(screen.getByRole('alert', { name: 'חישוב שכר חסר' })).toBeTruthy();
});

it('labels the 125% and 150% overtime tiers in the Hebrew breakdown', () => {
  renderApp(<SalaryBreakdown result={tieredResult} status="estimated" />);
  fireEvent.press(screen.getByRole('button', { name: 'פירוט שכר' }));

  expect(screen.getByText(/שעות נוספות 125%/)).toBeTruthy();
  expect(screen.getByText(/שעות נוספות 150%/)).toBeTruthy();
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
