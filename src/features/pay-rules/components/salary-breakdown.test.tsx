import { fireEvent, screen } from '@testing-library/react-native';

import { calculateSalary } from '@/domain/services';
import { SalaryBreakdown } from '@/features/pay-rules/components/salary-breakdown';
import { createSalaryProfile, createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const result = calculateSalary({
  shift: createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [],
  breaks: [],
  holidayIntervals: [],
  calculatedAt: '2026-07-15T22:00:00+03:00',
});

it('shows a simple salary estimate and discloses calculation details on request', () => {
  renderApp(<SalaryBreakdown result={result} status="estimated" />);

  expect(screen.getByText('שכר משוער')).toBeTruthy();
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
