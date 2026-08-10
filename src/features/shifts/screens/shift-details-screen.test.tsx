import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import ShiftDetailsScreen from '@/app/shifts/[id]';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const mockDeleteMany = jest.fn();
const mockClear = jest.fn();

const mockCompletedShift = createShift({
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
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockCompletedShift.id }),
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
  useShift: () => ({ shift: mockCompletedShift, loading: false, error: null, refresh: jest.fn(), clear: mockClear }),
}));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({ useShiftTemplates: () => ({ templates: [] }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'Workplace' }], roles: [] }),
}));
jest.mock('@/features/pay-rules', () => ({
  SalaryBreakdown: () => null,
  useSalaryDashboard: () => ({ summary: undefined, coordinator: {} }),
}));

describe('ShiftDetailsScreen deletion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('permanently deletes a non-recurring completed shift without scheduled timestamps', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => buttons?.[1]?.onPress?.());
    renderApp(<ShiftDetailsScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'מחיקה' }));

    await waitFor(() => expect(mockDeleteMany).toHaveBeenCalledWith([mockCompletedShift.id]));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/calendar');
  });
});
