import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import ShiftDetailsScreen from '@/app/shifts/[id]';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const mockDeleteMany = jest.fn();
const mockClear = jest.fn();

const completedShift = createShift({
  status: 'completed',
  scheduledStart: undefined,
  scheduledEnd: undefined,
  actualStart: '2026-08-09T08:00:00+03:00',
  actualEnd: '2026-08-09T16:00:00+03:00',
  actualBreakMinutes: 0,
  payableStart: '2026-08-09T08:00:00+03:00',
  payableEnd: '2026-08-09T16:00:00+03:00',
  payableBreakMinutes: 0,
  payableSource: 'actual',
  completedAt: '2026-08-09T16:00:00+03:00',
  salaryCalculationStatus: 'finalized',
});
let mockShift = completedShift;
let mockIncludeSalaryResult = true;

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockShift.id }),
}));
jest.mock('@/features/settings/store/app-store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({ activeShift: null, setActiveShift: jest.fn() }),
}));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({
    shifts: { deleteMany: mockDeleteMany, list: jest.fn() },
    recurrence: { getSeries: jest.fn(), applyMutation: jest.fn() },
  }),
}));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({
  useShift: () => ({ shift: mockShift, loading: false, error: null, refresh: jest.fn(), clear: mockClear }),
}));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({ useShiftTemplates: () => ({ templates: [] }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'Workplace' }], roles: [] }),
}));
jest.mock('@/features/pay-rules', () => ({
  ...jest.requireActual('@/features/pay-rules'),
  useSalaryDashboard: () => {
    const { calculateSalary } = jest.requireActual('@/domain/services');
    const { createSalaryProfile } = jest.requireActual('@/test/fixtures');
    const result = calculateSalary({
      shift: mockShift,
      profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
      rules: [], breaks: [], holidayIntervals: [], calculatedAt: '2026-08-09T16:00:00+03:00',
    });
    return { summary: { resultsByShiftId: mockIncludeSalaryResult ? { [mockShift.id]: result } : {} }, coordinator: {} };
  },
}));

describe('ShiftDetailsScreen deletion', () => {
  beforeEach(() => {
    mockShift = completedShift;
    mockIncludeSalaryResult = true;
    jest.clearAllMocks();
  });

  it('permanently deletes a non-recurring completed shift without scheduled timestamps', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => buttons?.[1]?.onPress?.());
    renderApp(<ShiftDetailsScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'מחיקה' }));

    await waitFor(() => expect(mockDeleteMany).toHaveBeenCalledWith([completedShift.id]));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/calendar');
  });

  it('presents a finalized snapshot as estimated pay and links assumptions to Salary Settings', () => {
    renderApp(<ShiftDetailsScreen />);

    expect(screen.getByRole('header', { name: 'הערכת שכר למשמרת' })).toBeTruthy();
    expect(screen.getByText('שכר משוער')).toBeTruthy();
    expect(screen.queryByText('שכר סופי')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'פתיחת הגדרות שכר' }));
    expect(router.push).toHaveBeenCalledWith('/settings/salary');
  });

  it('presents a complete live calculation for a scheduled not-calculated shift as an estimate', () => {
    mockShift = createShift({
      id: 'scheduled-live-estimate',
      status: 'scheduled',
      salaryCalculationStatus: 'not_calculated',
      scheduledStart: '2026-08-29T17:30:00+03:00',
      scheduledEnd: '2026-08-30T05:30:00+03:00',
      expectedBreakMinutes: 0,
    });

    renderApp(<ShiftDetailsScreen />);

    expect(screen.getByTestId('e2e-salary-total').props.accessibilityLabel).toBe('81000');
    expect(screen.getByText(/8 שעות × 100%.*2 שעות × 125%.*2 שעות × 150%/)).toBeTruthy();
    expect(screen.getByText('הערכת שכר בסיסית')).toBeTruthy();
    expect(screen.queryByText('הערכת השכר אינה זמינה')).toBeNull();
  });

  it('keeps a scheduled shift unavailable when no live calculation result exists', () => {
    mockShift = createShift({
      id: 'scheduled-missing-estimate',
      status: 'scheduled',
      salaryCalculationStatus: 'not_calculated',
      scheduledStart: '2026-08-30T17:30:00+03:00',
      scheduledEnd: '2026-08-31T05:30:00+03:00',
      expectedBreakMinutes: 0,
    });
    mockIncludeSalaryResult = false;

    renderApp(<ShiftDetailsScreen />);

    expect(screen.getAllByText('הערכת השכר אינה זמינה')).toHaveLength(1);
    expect(screen.queryByTestId('e2e-salary-total')).toBeNull();
  });
});
