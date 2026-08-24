import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ReportsScreen from '@/app/(tabs)/reports';
import type { MonthlyReport } from '@/features/reports/monthly-report-service';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const shift = createShift({
  id: 'shift', workplaceId: 'workplace-1', status: 'completed',
  actualStart: '2026-08-08T17:20:00+03:00', actualEnd: '2026-08-09T05:20:00+03:00',
  payableStart: '2026-08-08T17:20:00+03:00', payableEnd: '2026-08-09T05:20:00+03:00',
  actualBreakMinutes: 0, payableBreakMinutes: 0, salaryCalculationStatus: 'finalized',
});
const mockReport: MonthlyReport = {
  month: '2026-08', timezone: 'Asia/Jerusalem', generatedAt: '2026-08-10T09:00:00+03:00',
  range: { start: '2026-08-01T00:00:00+03:00', end: '2026-09-01T00:00:00+03:00' },
  rows: [{ shiftId: shift.id, shift, workplaceName: 'קפה', start: shift.payableStart!, end: shift.payableEnd!, paidMinutes: 720, breakMinutes: 0, salaryStatus: 'available', salaryMinor: 117_000 }],
  totals: { shiftCount: 1, paidMinutes: 720, breakMinutes: 0, availableSalaryMinor: 117_000, salaryMinor: 117_000, salaryIssueCount: 0, invalidShiftCount: 0 },
};

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/reports/use-monthly-report', () => ({ useMonthlyReport: () => ({ report: mockReport, loading: false, error: null }) }));

describe('ReportsScreen', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T09:00:00+03:00'));
  });

  afterAll(() => jest.useRealTimers());

  it('shows a focused monthly estimated-pay report and one export path', () => {
    renderApp(<ReportsScreen />);

    expect(screen.getByRole('header', { name: 'אוגוסט 2026' })).toBeTruthy();
    expect(screen.getByText('משמרת אחת הושלמה')).toBeTruthy();
    expect(screen.getByText('12 שעות עבודה')).toBeTruthy();
    const formattedSalary = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1170);
    expect(screen.getByText(`סה״כ שכר משוער: ${formattedSalary}`)).toBeTruthy();
    expect(screen.getByText(/שבת/)).toBeTruthy();
    expect(screen.getByText('12:00 שעות')).toBeTruthy();
    expect(screen.getByText('קפה')).toBeTruthy();
    expect(screen.queryByText('פירוט שכר')).toBeNull();
    expect(screen.queryByText('סוג משמרות')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'ייצוא הדוח' }));
    expect(router.push).toHaveBeenCalledWith('/settings/exports?month=2026-08');
  });

  it('uses singular Hebrew copy when one shift has unavailable salary', () => {
    mockReport.totals.salaryIssueCount = 1;
    mockReport.totals.salaryMinor = undefined;

    renderApp(<ReportsScreen />);

    expect(screen.getByText('הערכת שכר לא זמינה עבור משמרת אחת')).toBeTruthy();

    mockReport.totals.salaryIssueCount = 0;
    mockReport.totals.salaryMinor = mockReport.totals.availableSalaryMinor;
  });
});
