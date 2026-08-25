import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ExportsScreen from '@/app/settings/exports';
import type { MonthlyReport } from '@/features/reports/monthly-report-service';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const missingShift = createShift({
  id: 'missing', status: 'completed', salaryCalculationStatus: 'not_calculated',
  actualStart: '2026-08-05T08:00:00+03:00', actualEnd: '2026-08-05T09:00:00+03:00',
  payableStart: '2026-08-05T08:00:00+03:00', payableEnd: '2026-08-05T09:00:00+03:00', payableBreakMinutes: 0,
});
const mockReport: MonthlyReport = {
  month: '2026-08', timezone: 'Asia/Jerusalem', generatedAt: '2026-08-12T10:00:00+03:00',
  range: { start: '2026-08-01T00:00:00+03:00', end: '2026-09-01T00:00:00+03:00' },
  rows: [{ shiftId: missingShift.id, shift: missingShift, workplaceName: 'קפה', start: missingShift.payableStart!, end: missingShift.payableEnd!, paidMinutes: 60, breakMinutes: 0, salaryStatus: 'missing', specialIntervals: [] }],
  totals: { shiftCount: 1, paidMinutes: 60, breakMinutes: 0, availableSalaryMinor: 0, salaryMinor: undefined, salaryIssueCount: 1, invalidShiftCount: 0 },
};

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ month: '2026-08' }), router: { back: jest.fn() } }));
jest.mock('@/features/reports/use-monthly-report', () => ({ useMonthlyReport: () => ({ report: mockReport, loading: false, error: null }) }));
jest.mock('@/features/exports/adapters/file-share-adapter', () => ({ shareFile: jest.fn() }));
jest.mock('@/features/exports/adapters/print-share-adapter', () => ({ processPdf: jest.fn() }));

describe('ExportsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exports the selected month and keeps a missing salary cell empty', async () => {
    renderApp(<ExportsScreen />);
    expect(screen.getByRole('header', { name: 'אוגוסט 2026' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'הפקת CSV' }));

    await waitFor(() => expect(shareFile).toHaveBeenCalled());
    const input = (shareFile as jest.Mock).mock.calls[0][0] as { filename: string; content: string };
    expect(input.filename).toBe('shiftty-report-2026-08.csv');
    expect(input.content).toContain('2026-08-05');
    expect(input.content).not.toContain('2026-08-05T08:00:00+03:00');
    const shiftLine = input.content.split('\r\n').find((line) => line.startsWith('2026-08-05'))!;
    expect(shiftLine.split(',')[9]).toBe('');
    expect(shiftLine).toContain('סכומי השכר הם הערכות המבוססות על ההגדרות שלך.');
    expect(shiftLine).toContain('ולא קביעה של זכאות משפטית.');
  });
});
