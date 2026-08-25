import { screen } from '@testing-library/react-native';

import { ReportShiftRow } from '@/features/reports/report-shift-row';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const completed = createShift({
  status: 'completed',
  actualStart: '2026-08-08T17:20:00+03:00',
  actualEnd: '2026-08-09T05:20:00+03:00',
  payableStart: '2026-08-08T17:20:00+03:00',
  payableEnd: '2026-08-09T05:20:00+03:00',
  actualBreakMinutes: 0,
  payableBreakMinutes: 0,
  payableSource: 'actual',
  completedAt: '2026-08-09T05:20:00+03:00',
  salaryCalculationStatus: 'finalized',
});

describe('ReportShiftRow', () => {
  it('shows localized date, duration, workplace, and estimated pay for the shift', () => {
    renderApp(<ReportShiftRow
      onPress={jest.fn()}
      salaryMinor={117_000}
      shift={completed}
      specialIntervals={[{
        intervalId: 'holiday-1',
        type: 'holiday',
        name: 'חג שאושר',
        contributedToEstimate: true,
      }, {
        intervalId: 'custom-no-rule',
        type: 'custom',
        name: 'סימון ללא כלל',
        contributedToEstimate: false,
      }]}
      workplaceName="קפה"
    />);

    expect(screen.getByText(/שבת/)).toBeTruthy();
    expect(screen.getByText('12:00 שעות')).toBeTruthy();
    expect(screen.getByText('קפה')).toBeTruthy();
    expect(screen.getByText(`שכר משוער: ${new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1170)}`)).toBeTruthy();
    expect(screen.getByTestId('report-special-intervals')).toHaveTextContent('חג: חג שאושר');
    expect(screen.queryByText(/סימון ללא כלל/)).toBeNull();
  });

  it('distinguishes missing, stale, and legitimate zero salary', () => {
    const { unmount } = renderApp(<ReportShiftRow onPress={jest.fn()} shift={completed} workplaceName="קפה" />);
    expect(screen.getByText('חישוב שכר חסר')).toBeTruthy();
    unmount();

    const stale = { ...completed, salaryCalculationStatus: 'stale' as const };
    const staleRender = renderApp(<ReportShiftRow onPress={jest.fn()} salaryMinor={48_000} shift={stale} workplaceName="קפה" />);
    expect(screen.getByText('חישוב שכר לא מעודכן')).toHaveStyle({ flexShrink: 1, maxWidth: '55%' });
    staleRender.unmount();

    renderApp(<ReportShiftRow onPress={jest.fn()} salaryMinor={0} shift={completed} workplaceName="קפה" />);
    expect(screen.getByText(`שכר משוער: ${new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0)}`)).toBeTruthy();
    expect(screen.queryByText('חישוב שכר חסר')).toBeNull();
  });
});
