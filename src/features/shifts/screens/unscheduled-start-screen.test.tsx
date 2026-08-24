import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import StartUnscheduledShiftScreen from '@/app/shifts/start/unscheduled';
import { renderApp } from '@/test/render';

const mockStartUnscheduled = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/features/shifts/hooks/use-active-shift', () => ({
  useActiveShift: () => ({ busy: false, startUnscheduled: mockStartUnscheduled }),
}));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({
  useShiftTemplates: () => ({
    templates: [{
      id: 'template-1',
      workplaceId: 'workplace-1',
      roleId: 'role-1',
      name: 'משמרת בוקר',
      defaultStartTime: '08:00',
      defaultEndTime: '16:00',
      payMultiplierBasisPoints: 15_000,
      expectedBreakMinutes: 20,
    }],
  }),
}));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({
    workplaces: [{
      id: 'workplace-1',
      name: 'קפה העיר',
      defaultHourlyRateMinor: 4_500,
      defaultBreakMinutes: 0,
      createdAt: '2026-01-01T00:00:00+02:00',
      updatedAt: '2026-01-01T00:00:00+02:00',
    }],
    roles: [{
      id: 'role-1',
      workplaceId: 'workplace-1',
      name: 'בריסטה',
      createdAt: '2026-01-01T00:00:00+02:00',
      updatedAt: '2026-01-01T00:00:00+02:00',
    }],
  }),
}));

describe('fallback start-now screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartUnscheduled.mockResolvedValue(undefined);
  });

  it('keeps the ordinary clock-in path focused on workplace selection', () => {
    renderApp(<StartUnscheduledShiftScreen />);

    expect(screen.getByText('מקום עבודה')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'התחלת משמרת עכשיו' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'אפשרויות נוספות' })).toBeTruthy();
    expect(screen.queryByText('תפקיד (רשות)')).toBeNull();
    expect(screen.queryByText('סוג משמרת (רשות)')).toBeNull();
    expect(screen.queryByLabelText('סיום צפוי (רשות)')).toBeNull();
    expect(screen.queryByLabelText('כותרת (רשות)')).toBeNull();
    expect(screen.queryByLabelText('הערות (רשות)')).toBeNull();
  });

  it('reveals optional planning metadata only on request', () => {
    renderApp(<StartUnscheduledShiftScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'קפה העיר' }));
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));

    expect(screen.getByText('תפקיד (רשות)')).toBeTruthy();
    expect(screen.getByText('סוג משמרת (רשות)')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'בריסטה' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'משמרת בוקר · 150%' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'סיום צפוי (רשות)' })).toBeTruthy();
    expect(screen.getByLabelText('כותרת (רשות)')).toBeTruthy();
    expect(screen.getByLabelText('הערות (רשות)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הסתר אפשרויות' })).toBeTruthy();
  });

  it('starts immediately without inventing optional metadata', async () => {
    renderApp(<StartUnscheduledShiftScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'קפה העיר' }));
    fireEvent.press(screen.getByRole('button', { name: 'התחלת משמרת עכשיו' }));

    await waitFor(() => {
      expect(mockStartUnscheduled).toHaveBeenCalledWith(expect.objectContaining({
        workplaceId: 'workplace-1',
        roleId: undefined,
        shiftTemplateId: undefined,
        title: undefined,
        notes: undefined,
        expectedEnd: undefined,
        expectedBreakMinutes: 0,
        status: 'active',
        activeOrigin: 'unscheduled',
        hourlyRateSnapshotMinor: 4_500,
      }));
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('snapshots the selected shift type and multiplier when starting now', async () => {
    renderApp(<StartUnscheduledShiftScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'קפה העיר' }));
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    fireEvent.press(screen.getByRole('radio', { name: 'משמרת בוקר · 150%' }));
    fireEvent.press(screen.getByRole('button', { name: 'התחלת משמרת עכשיו' }));

    await waitFor(() => expect(mockStartUnscheduled).toHaveBeenCalledWith(expect.objectContaining({
      shiftTemplateId: 'template-1',
      shiftTypeNameSnapshot: 'משמרת בוקר',
      shiftTypePayMultiplierBasisPoints: 15_000,
      expectedBreakMinutes: 20,
    })));
  });
});
