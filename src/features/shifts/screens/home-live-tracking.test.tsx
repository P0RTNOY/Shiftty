import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';
import { renderApp } from '@/test/render';
import { createShift } from '@/test/fixtures';

const mockActiveHook = jest.fn();
const mockSalaryHook = jest.fn();
const mockShiftsHook = jest.fn();
const mockNearbyShiftsHook = jest.fn();
const mockWorkplacesHook = jest.fn();
const mockStartScheduled = jest.fn();
const mockStartUnscheduled = jest.fn();
const mockCompleteShift = jest.fn();
jest.mock('@/features/shifts/hooks/use-active-shift', () => ({ useActiveShift: () => mockActiveHook() }));
jest.mock('@/features/shifts/hooks/use-shifts', () => ({ useShifts: (query: { statuses?: string[] }) => query.statuses ? mockNearbyShiftsHook() : mockShiftsHook() }));
jest.mock('@/features/shifts/hooks/use-shift-templates', () => ({ useShiftTemplates: () => ({ templates: [] }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => mockWorkplacesHook() }));
jest.mock('@/features/pay-rules', () => ({
  useSalaryDashboard: (shifts: unknown, calculatedAt: string, activeEnd?: string, reportingRange?: unknown) =>
    mockSalaryHook(shifts, calculatedAt, activeEnd, reportingRange),
}));
jest.mock('@/shared/hooks', () => ({ useLiveNow: () => new Date('2026-07-15T17:00:00+03:00') }));
jest.mock('@/shared/utils/clock', () => ({ systemClock: { now: () => new Date('2026-07-15T17:00:30+03:00') } }));
jest.mock('@/features/shifts/hooks/use-shift-prediction', () => ({ useShiftPrediction: () => [null, jest.fn()] }));

const workplace = {
  id: 'workplace-1',
  name: 'קפה העיר',
  defaultHourlyRateMinor: 4_500,
  defaultBreakMinutes: 30,
  createdAt: '2026-01-01T00:00:00+02:00',
  updatedAt: '2026-01-01T00:00:00+02:00',
};
const emptyActive = {
  activeShift: null,
  breaks: [],
  busy: false,
  error: null,
  salaryError: null,
  startBreak: jest.fn(),
  endBreak: jest.fn(),
  startScheduled: mockStartScheduled,
  startUnscheduled: mockStartUnscheduled,
  completeShift: mockCompleteShift,
};

describe('Home live tracking state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSalaryHook.mockReturnValue({ summary: null, loading: false, error: null, coordinator: {} });
    mockShiftsHook.mockReturnValue({ shifts: [], loading: false, error: null });
    mockNearbyShiftsHook.mockReturnValue({ shifts: [], loading: false, error: null });
    mockWorkplacesHook.mockReturnValue({ workplaces: [workplace], roles: [] });
    mockStartScheduled.mockResolvedValue(undefined);
    mockStartUnscheduled.mockResolvedValue(undefined);
    mockCompleteShift.mockResolvedValue(undefined);
  });

  it('shows the start-now action when no shift is active', () => {
    mockActiveHook.mockReturnValue(emptyActive); renderApp(<HomeScreen />);
    expect(screen.getByRole('button', { name: 'כניסה' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'הוספת משמרת' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'הוספת משמרת עתידית' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'הוספת משמרת שהושלמה' })).toBeNull();
  });

  it('starts the nearby scheduled shift from the primary clock-in action', async () => {
    mockActiveHook.mockReturnValue(emptyActive);
    mockShiftsHook.mockReturnValue({
      shifts: [createShift({ id: 'scheduled-1', scheduledStart: '2026-07-15T16:30:00+03:00', scheduledEnd: '2026-07-15T22:00:00+03:00' })],
      loading: false,
      error: null,
    });
    mockNearbyShiftsHook.mockReturnValue({
      shifts: [createShift({ id: 'scheduled-1', scheduledStart: '2026-07-15T16:30:00+03:00', scheduledEnd: '2026-07-15T22:00:00+03:00' })],
      loading: false,
      error: null,
    });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'כניסה' }));

    await waitFor(() => expect(mockStartScheduled).toHaveBeenCalledWith('scheduled-1', '2026-07-15T14:00:30.000Z'));
    expect(mockStartUnscheduled).not.toHaveBeenCalled();
  });

  it('uses the dedicated nearby query when the monthly reporting set is empty', async () => {
    mockActiveHook.mockReturnValue(emptyActive);
    mockNearbyShiftsHook.mockReturnValue({
      shifts: [createShift({ id: 'boundary-shift', scheduledStart: '2026-07-15T16:45:00+03:00', scheduledEnd: '2026-07-16T00:45:00+03:00' })],
      loading: false,
      error: null,
    });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'כניסה' }));

    await waitFor(() => expect(mockStartScheduled).toHaveBeenCalledWith('boundary-shift', '2026-07-15T14:00:30.000Z'));
  });

  it('starts an unscheduled shift immediately when there is one active workplace', async () => {
    mockActiveHook.mockReturnValue(emptyActive);
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'כניסה' }));

    await waitFor(() => expect(mockStartUnscheduled).toHaveBeenCalledWith(expect.objectContaining({
      workplaceId: 'workplace-1',
      status: 'active',
      activeOrigin: 'unscheduled',
      hourlyRateSnapshotMinor: 4_500,
      actualStart: '2026-07-15T14:00:30.000Z',
    })));
  });

  it('asks which workplace before clocking in when several are active', async () => {
    mockActiveHook.mockReturnValue(emptyActive);
    mockWorkplacesHook.mockReturnValue({ workplaces: [workplace, { ...workplace, id: 'workplace-2', name: 'הסניף השני' }], roles: [] });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('איפה עובדים עכשיו?')).toBeTruthy();
    expect(mockStartUnscheduled).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'הסניף השני' }));
    await waitFor(() => expect(mockStartUnscheduled).toHaveBeenCalledWith(expect.objectContaining({ workplaceId: 'workplace-2' })));
  });

  it('replaces the dashboard with active tracking restored from persistence', () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' }) }); renderApp(<HomeScreen />);
    expect(screen.getByText('עובדים')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'כניסה' })).toBeNull();
  });

  it('quickly reviews and saves clock-out with actual-time defaults', async () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' }) });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'יציאה' }));
    expect(screen.getByText('סיימת משמרת')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'שמור' }));

    await waitFor(() => expect(mockCompleteShift).toHaveBeenCalledWith({
      shiftId: 'shift-1',
      actualEnd: '2026-07-15T14:00:30.000Z',
      payableStart: '2026-07-15T13:00:00+03:00',
      payableEnd: '2026-07-15T14:00:30.000Z',
      actualBreakMinutes: 0,
      payableBreakMinutes: 0,
      payableSource: 'actual',
      closeOpenBreak: false,
    }));
  });

  it('calculates the clock-out review at the exact timestamp that will be saved', () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' }) });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'יציאה' }));

    expect(mockSalaryHook.mock.calls).toContainEqual([
      expect.any(Array),
      '2026-07-15T14:00:30.000Z',
      '2026-07-15T14:00:30.000Z',
      undefined,
    ]);
  });

  it('does not show a salary preview calculated for an earlier timestamp', () => {
    const activeShift = createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' });
    const stalePay = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(24_000 / 100);
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift });
    mockSalaryHook.mockReturnValue({
      summary: {
        resultsByShiftId: {
          [activeShift.id]: {
            sourceRange: { start: activeShift.actualStart, end: '2026-07-15T14:00:00.000Z' },
            totalGrossPayMinor: 24_000,
          },
        },
      },
      loading: false,
      error: null,
      coordinator: {},
    });
    renderApp(<HomeScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'יציאה' }));

    expect(screen.queryByText(stalePay)).toBeNull();
  });

  it('offers recovery instead of auto-ending a stale shift', () => {
    mockActiveHook.mockReturnValue({ ...emptyActive, activeShift: createShift({ status: 'active', actualStart: '2026-07-14T23:00:00+03:00', activeOrigin: 'scheduled' }) }); renderApp(<HomeScreen />);
    expect(screen.getByText('המשמרת עדיין פעילה')).toBeTruthy(); expect(screen.getByRole('button', { name: 'שכחת לבצע יציאה?' })).toBeTruthy();
  });

  it('keeps the default monthly summary compact', () => {
    mockActiveHook.mockReturnValue(emptyActive);
    mockSalaryHook.mockReturnValue({ summary: { earnedMinor: 482000, futureMinor: 324000, forecastMinor: 806000, incompleteShiftCount: 0, regularMinutes: 480, specialRateMinutes: 60, resultsByShiftId: {} }, loading: false, error: null, coordinator: {} });
    renderApp(<HomeScreen />);
    expect(screen.getByText('שעות שהושלמו')).toBeTruthy();
    expect(screen.getByText('נצבר עד עכשיו')).toBeTruthy();
    expect(screen.queryByText('צפוי ממשמרות עתידיות')).toBeNull();
    expect(screen.queryByText('תחזית חודשית')).toBeNull();
    expect(screen.queryByText('שעות מיוחדות')).toBeNull();
  });
});
