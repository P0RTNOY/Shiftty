import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import EditShiftScreen from '@/app/shifts/[id]/edit';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const mockFindOverlapping = jest.fn();
const mockUpdate = jest.fn();
const mockFinalizeCompletedShift = jest.fn();

const mockCompletedShift = createShift({
  status: 'completed',
  actualStart: '2026-08-09T08:00:00+03:00',
  actualEnd: '2026-08-09T16:00:00+03:00',
  actualBreakMinutes: 30,
  payableStart: '2026-08-09T08:00:00+03:00',
  payableEnd: '2026-08-09T16:00:00+03:00',
  payableBreakMinutes: 30,
  payableSource: 'actual',
  completedAt: '2026-08-09T16:00:00+03:00',
  recurrenceGroupId: 'series-1',
  recurrenceOriginalStart: '2026-08-09T08:00:00+03:00',
  salaryCalculationStatus: 'finalized',
  payableGrossPayMinor: 33_750,
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockCompletedShift.id }),
}));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({
    shifts: { findOverlapping: mockFindOverlapping, update: mockUpdate },
  }),
}));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({
  useShift: () => ({ shift: mockCompletedShift, loading: false }),
}));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({ useShiftTemplates: () => ({ templates: [] }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({
    workplaces: [{
      id: mockCompletedShift.workplaceId,
      name: 'בית קפה',
      defaultHourlyRateMinor: 4_500,
      defaultBreakMinutes: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }],
    roles: [],
  }),
}));
jest.mock('@/features/pay-rules/services/salary-calculation-coordinator', () => ({
  SalaryCalculationCoordinator: jest.fn().mockImplementation(() => ({
    finalizeCompletedShift: mockFinalizeCompletedShift,
  })),
}));

jest.mock('@/shared/components/date-field', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DateField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value ?? '', onChangeText: onChange }),
    TimeField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value ?? '', onChangeText: onChange }),
  };
});

describe('EditShiftScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOverlapping.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
    mockFinalizeCompletedShift.mockResolvedValue(undefined);
  });

  it('automatically refreshes finalized salary after saving a completed shift', async () => {
    renderApp(<EditShiftScreen />);

    fireEvent.changeText(screen.getByLabelText('הפסקה'), '20');
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const updatedShift = mockUpdate.mock.calls[0][0];
    expect(updatedShift).toMatchObject({
      id: mockCompletedShift.id,
      actualBreakMinutes: 20,
      payableBreakMinutes: 20,
      salaryCalculationStatus: 'stale',
    });
    expect(mockFinalizeCompletedShift).toHaveBeenCalledWith(updatedShift, updatedShift.updatedAt, true);
    expect(router.replace).toHaveBeenCalledWith(`/shifts/${mockCompletedShift.id}`);
  });
});
