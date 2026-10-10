import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import NewShiftScreen from '@/app/shifts/new';
import type { Shift, ShiftTemplate, Workplace } from '@/domain/entities';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const mockCreate = jest.fn();
let mockSetShiftResult: ((result: { shift: Shift | null; loading: boolean; error: string | null }) => void) | undefined;

const mockWorkplace: Workplace = {
  id: 'work-1',
  name: 'Cafe',
  defaultHourlyRateMinor: 4_000,
  defaultBreakMinutes: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockMorningType: ShiftTemplate = {
  id: 'morning',
  name: 'Morning',
  defaultStartTime: '05:30',
  defaultEndTime: '14:00',
  payMultiplierBasisPoints: 10_000,
  expectedBreakMinutes: 30,
  workplaceId: mockWorkplace.id,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockDuplicateSource = createShift({
  id: 'source-shift',
  workplaceId: mockWorkplace.id,
  shiftTemplateId: mockMorningType.id,
  shiftTypeNameSnapshot: mockMorningType.name,
  shiftTypePayMultiplierBasisPoints: mockMorningType.payMultiplierBasisPoints,
  scheduledStart: '2026-08-28T05:30:00+03:00',
  scheduledEnd: '2026-08-28T14:00:00+03:00',
  expectedBreakMinutes: mockMorningType.expectedBreakMinutes,
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ mode: 'scheduled', duplicate: mockDuplicateSource.id }),
}));

jest.mock('@/features/shifts/hooks/use-shifts', () => ({
  useShift: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [result, setResult] = React.useState<{ shift: Shift | null; loading: boolean; error: string | null }>({ shift: null, loading: true, error: null });
    mockSetShiftResult = setResult;
    return result;
  },
}));

jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({
    shifts: { create: mockCreate, findOverlapping: jest.fn().mockResolvedValue([]) },
    recurrence: {},
  }),
}));

jest.mock('@/features/shifts/hooks/use-active-shift', () => ({
  useActiveShift: () => ({ busy: false, startUnscheduled: jest.fn() }),
}));

jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({
  useShiftTemplates: () => ({ templates: [mockMorningType] }),
}));

jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({ workplaces: [mockWorkplace], roles: [] }),
}));

jest.mock('@/shared/components/date-field', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DateField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value ?? '', onChangeText: onChange }),
    TimeField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value ?? '', onChangeText: onChange }),
  };
});

describe('NewShiftScreen duplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetShiftResult = undefined;
  });

  it('waits for the source, transfers its shift type, and keeps the type selectable', async () => {
    renderApp(<NewShiftScreen />);

    expect(screen.getByText('טוענים…')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Morning · 100%' })).toBeNull();

    act(() => mockSetShiftResult?.({ shift: mockDuplicateSource, loading: false, error: null }));

    const morning = screen.getByRole('radio', { name: 'Morning · 100%' });
    expect(morning).toHaveProp('accessibilityState', { checked: true });
    expect(screen.getByLabelText('התחלה')).toHaveProp('value', '05:30');
    expect(screen.getByLabelText('סיום')).toHaveProp('value', '14:00');

    fireEvent.press(screen.getByRole('radio', { name: 'ללא סוג משמרת' }));
    expect(morning).toHaveProp('accessibilityState', { checked: false });

    fireEvent.press(morning);
    expect(morning).toHaveProp('accessibilityState', { checked: true });
    expect(screen.getByLabelText('התחלה')).toHaveProp('value', '05:30');
    expect(screen.getByLabelText('סיום')).toHaveProp('value', '14:00');

    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      shiftTemplateId: mockMorningType.id,
      shiftTypeNameSnapshot: mockMorningType.name,
      shiftTypePayMultiplierBasisPoints: mockMorningType.payMultiplierBasisPoints,
    })));
  });
});
