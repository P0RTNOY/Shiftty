import { screen } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';
import { renderApp } from '@/test/render';
import { createShift } from '@/test/fixtures';

const mockActiveHook = jest.fn();
const mockSalaryHook = jest.fn();
jest.mock('@/features/shifts/hooks/use-active-shift', () => ({ useActiveShift: () => mockActiveHook() }));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({ useShifts: () => ({ shifts: [], loading: false, error: null }) }));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({ useShiftTemplates: () => ({ templates: [] }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה העיר' }], roles: [] }) }));
jest.mock('@/features/pay-rules', () => ({ useSalaryDashboard: () => mockSalaryHook() }));
jest.mock('@/shared/hooks', () => ({ useLiveNow: () => new Date('2026-07-15T17:00:00+03:00') }));

const emptyActive = { activeShift: null, breaks: [], busy: false, error: null, startBreak: jest.fn(), endBreak: jest.fn() };

describe('Home live tracking state', () => {
  beforeEach(() => mockSalaryHook.mockReturnValue({ summary: null, loading: false, error: null, coordinator: {} }));
  it('shows the start-now action when no shift is active', () => {
    mockActiveHook.mockReturnValue(emptyActive); renderApp(<HomeScreen />);
    expect(screen.getByRole('button', { name: 'התחלת משמרת עכשיו' })).toBeTruthy();
  });

  it('replaces the dashboard with active tracking restored from persistence', () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' }) }); renderApp(<HomeScreen />);
    expect(screen.getByText('עובדים')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'התחלת משמרת עכשיו' })).toBeNull();
  });

  it('offers recovery instead of auto-ending a stale shift', () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-14T23:00:00+03:00', activeOrigin: 'scheduled' }) }); renderApp(<HomeScreen />);
    expect(screen.getByText('המשמרת עדיין פעילה')).toBeTruthy(); expect(screen.getByRole('button', { name: 'שכחת לבצע יציאה?' })).toBeTruthy();
  });

  it('separates earned, future and forecast salary in Hebrew', () => {
    mockActiveHook.mockReturnValue(emptyActive);
    mockSalaryHook.mockReturnValue({ summary: { earnedMinor: 482000, futureMinor: 324000, forecastMinor: 806000, incompleteShiftCount: 0, regularMinutes: 480, specialRateMinutes: 60, resultsByShiftId: {} }, loading: false, error: null, coordinator: {} });
    renderApp(<HomeScreen />);
    expect(screen.getByText('נצבר עד עכשיו')).toBeTruthy(); expect(screen.getByText('צפוי ממשמרות עתידיות')).toBeTruthy(); expect(screen.getByText('תחזית חודשית')).toBeTruthy();
  });
});
