import { fireEvent, screen } from '@testing-library/react-native';

import ReportsScreen from '@/app/(tabs)/reports';
import { renderApp } from '@/test/render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({
  useShifts: () => ({
    shifts: [{
      id: 'shift',
      workplaceId: 'workplace-1',
      status: 'completed',
      actualStart: '2026-08-08T17:20:00+03:00',
      actualEnd: '2026-08-09T05:20:00+03:00',
      payableStart: '2026-08-08T17:20:00+03:00',
      payableEnd: '2026-08-09T05:20:00+03:00',
      actualBreakMinutes: 0,
      payableBreakMinutes: 0,
      payableSource: 'actual',
      completedAt: '2026-08-09T05:20:00+03:00',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 5_000,
      salaryCalculationStatus: 'finalized',
      timezone: 'Asia/Jerusalem',
      createdAt: '2026-08-01T08:00:00+03:00',
      updatedAt: '2026-08-01T08:00:00+03:00',
    }],
    loading: false,
  }),
}));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה' }], roles: [] }) }));
jest.mock('@/features/pay-rules', () => ({ useSalaryDashboard: () => ({ summary: { earnedMinor: 117_000, futureMinor: 0, forecastMinor: 117_000, incompleteShiftCount: 0, staleShiftCount: 0, regularMinutes: 0, specialRateMinutes: 720, basePayMinor: 72_000, premiumPayMinor: 45_000, minimumAdjustmentsMinor: 0, bonusesMinor: 0, reimbursementsMinor: 0, resultsByShiftId: { shift: { totalGrossPayMinor: 117_000, issues: [], segments: [] } }, byWorkplace: { 'workplace-1': { minutes: 720, totalMinor: 117_000 } }, byRole: {}, byMultiplier: { '15000': { minutes: 480, totalMinor: 72_000 }, '17500': { minutes: 120, totalMinor: 21_000 }, '20000': { minutes: 120, totalMinor: 24_000 } }, byDate: { '2026-08-08': { minutes: 400, totalMinor: 60_000 }, '2026-08-09': { minutes: 320, totalMinor: 57_000 } } } }) }));

describe('ReportsScreen', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T09:00:00+03:00'));
  });

  afterAll(() => jest.useRealTimers());

  it('shows a simple monthly report and discloses salary details on request', () => {
    renderApp(<ReportsScreen />);

    expect(screen.getByRole('header', { name: 'אוגוסט 2026' })).toBeTruthy();
    expect(screen.getByText('1 משמרות שהושלמו')).toBeTruthy();
    expect(screen.getByText('12:00 שעות עבודה')).toBeTruthy();
    const formattedSalary = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1170);
    expect(screen.getByText(`${formattedSalary} שכר`)).toBeTruthy();
    expect(screen.getAllByText(formattedSalary)).toHaveLength(1);
    expect(screen.getByText(/שבת/)).toBeTruthy();
    expect(screen.getByText('12:00 שעות')).toBeTruthy();
    expect(screen.getByText('קפה')).toBeTruthy();
    expect(screen.queryByText('שכר בסיס')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'פירוט שכר' }));
    expect(screen.getByText('שכר בסיס')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'פירוט לפי מקום עבודה' })).toBeTruthy();
    expect(screen.getByText('150%')).toBeTruthy();
  });
});
