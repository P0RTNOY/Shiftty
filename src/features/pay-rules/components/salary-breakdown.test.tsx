import { screen } from '@testing-library/react-native';
import { SalaryBreakdown } from '@/features/pay-rules/components/salary-breakdown';
import { calculateSalary } from '@/domain/services';
import { createSalaryProfile, createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

it('renders an accessible Hebrew salary explanation without relying on color', () => {
  const result = calculateSalary({ shift: createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 }), profile: createSalaryProfile({ baseHourlyRateMinor: 6000 }), rules: [], breaks: [], holidayIntervals: [], calculatedAt: '2026-07-15T22:00:00+03:00' });
  renderApp(<SalaryBreakdown result={result} status="estimated" />);
  expect(screen.getByRole('header', { name: 'פירוט חישוב' })).toBeTruthy();
  expect(screen.getByLabelText('הערכה בלבד')).toBeTruthy();
  expect(screen.getByText('שכר בסיס')).toBeTruthy();
});
