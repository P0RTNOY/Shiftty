import { screen } from '@testing-library/react-native';
import ReportsScreen from '@/app/(tabs)/reports';
import { renderApp } from '@/test/render';

jest.mock('@/features/shifts/hooks/use-shifts', () => ({ useShifts: () => ({ shifts: [{ id: 'shift', status: 'scheduled', scheduledStart: '2026-08-04T08:00:00+03:00', scheduledEnd: '2026-08-04T10:00:00+03:00', expectedBreakMinutes: 0 }], loading: false }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה' }], roles: [] }) }));
jest.mock('@/features/pay-rules', () => ({ useSalaryDashboard: () => ({ summary: { earnedMinor: 12000, futureMinor: 18000, forecastMinor: 30000, incompleteShiftCount: 0, staleShiftCount: 0, regularMinutes: 180, specialRateMinutes: 60, basePayMinor: 24000, premiumPayMinor: 3000, minimumAdjustmentsMinor: 0, bonusesMinor: 1000, reimbursementsMinor: 2000, byWorkplace: { 'workplace-1': { minutes: 240, totalMinor: 30000 } }, byRole: {}, byMultiplier: { '12500': { minutes: 60, totalMinor: 7500 } }, byDate: { '2026-08-04': { minutes: 240, totalMinor: 30000 } } } }) }));

it('renders accessible financial totals and breakdown labels in Hebrew', () => {
  renderApp(<ReportsScreen />);
  expect(screen.getByText('שכר בסיס')).toBeTruthy(); expect(screen.getByText('תוספות שעות')).toBeTruthy(); expect(screen.getByRole('header', { name: 'פירוט לפי מקום עבודה' })).toBeTruthy(); expect(screen.getByText('125%')).toBeTruthy();
});
