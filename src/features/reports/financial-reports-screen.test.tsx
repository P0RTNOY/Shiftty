import { fireEvent, screen } from '@testing-library/react-native';

import ReportsScreen from '@/app/(tabs)/reports';
import { renderApp } from '@/test/render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({
  useShifts: () => ({
    shifts: [{
      id: 'shift',
      workplaceId: 'workplace-1',
      status: 'scheduled',
      scheduledStart: '2026-08-14T08:00:00+03:00',
      scheduledEnd: '2026-08-14T10:00:00+03:00',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 5_000,
      timezone: 'Asia/Jerusalem',
      createdAt: '2026-08-01T08:00:00+03:00',
      updatedAt: '2026-08-01T08:00:00+03:00',
    }],
    loading: false,
  }),
}));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה' }], roles: [] }) }));
jest.mock('@/features/pay-rules', () => ({ useSalaryDashboard: () => ({ summary: { earnedMinor: 12_000, futureMinor: 18_000, forecastMinor: 30_000, incompleteShiftCount: 0, staleShiftCount: 0, regularMinutes: 180, specialRateMinutes: 60, basePayMinor: 24_000, premiumPayMinor: 3_000, minimumAdjustmentsMinor: 0, bonusesMinor: 1_000, reimbursementsMinor: 2_000, byWorkplace: { 'workplace-1': { minutes: 240, totalMinor: 30_000 } }, byRole: {}, byMultiplier: { '12500': { minutes: 60, totalMinor: 7_500 } }, byDate: { '2026-08-14': { minutes: 240, totalMinor: 30_000 } } } }) }));

describe('ReportsScreen', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T09:00:00+03:00'));
  });

  afterAll(() => jest.useRealTimers());

  it('shows a simple monthly report and discloses salary details on request', () => {
    renderApp(<ReportsScreen />);

    expect(screen.getByRole('header', { name: 'אוגוסט 2026' })).toBeTruthy();
    expect(screen.getByText('1 משמרות')).toBeTruthy();
    expect(screen.getByText('2:00 שעות')).toBeTruthy();
    expect(screen.getByText(`${new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(300)} צפויים`)).toBeTruthy();
    expect(screen.getByText('קפה')).toBeTruthy();
    expect(screen.queryByText('שכר בסיס')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'פירוט שכר' }));
    expect(screen.getByText('שכר בסיס')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'פירוט לפי מקום עבודה' })).toBeTruthy();
    expect(screen.getByText('125%')).toBeTruthy();
  });
});
