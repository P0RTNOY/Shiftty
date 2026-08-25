import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import HolidaysRestScreen from '@/app/settings/salary/holidays-rest';
import { createCalendarEvidenceInterval, createSalaryProfile } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const interval = createCalendarEvidenceInterval({ name: 'חג מוגדר' });
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockListForScope = jest.fn().mockResolvedValue([interval]);
const mockGetProfile = jest.fn().mockResolvedValue(createSalaryProfile({ name: 'שכר קיץ' }));
let mockFocusInvoked = false;

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void) => { if (!mockFocusInvoked) { mockFocusInvoked = true; callback(); } },
  useLocalSearchParams: () => ({ profileId: 'profile-1' }),
}));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({
    salaryProfiles: { getById: mockGetProfile },
    calendarEvidenceIntervals: { listForScope: mockListForScope, save: jest.fn(), archive: jest.fn(), delete: mockDelete },
    weeklyRestSchedules: { getForProfile: jest.fn().mockResolvedValue(null), save: jest.fn() },
    payRules: { listForProfile: jest.fn().mockResolvedValue([]) },
  }),
}));

describe('HolidaysRestScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockFocusInvoked = false; });

  it('loads the profile-scoped advanced settings and opens a type-scoped pay-rule editor', async () => {
    renderApp(<HolidaysRestScreen />);

    expect(await screen.findByText('שכר קיץ')).toBeTruthy();
    expect(mockListForScope).toHaveBeenCalledWith({ workplaceId: 'workplace-1', salaryProfileId: 'profile-1', includeArchived: true });
    expect(screen.getByText('חג מוגדר')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'הגדרת כלל שכר לטווח' }));
    expect(router.push).toHaveBeenCalledWith('/settings/salary/rules?profileId=profile-1&kind=specialInterval&intervalType=holiday');
  });

  it('requires confirmation before deleting and leaves stored-history expectations visible', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    renderApp(<HolidaysRestScreen />);
    await screen.findByText('חג מוגדר');
    fireEvent.press(screen.getByRole('button', { name: 'מחיקה' }));

    expect(alert).toHaveBeenCalledWith(
      'למחוק את הטווח?',
      expect.stringContaining('ההסבר שנשמר'),
      expect.any(Array),
    );
    const actions = alert.mock.calls[0]![2]!;
    actions[1]!.onPress?.();
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('evidence-1'));
    expect(screen.getByText(/הערכות שכר שמורות/)).toBeTruthy();
    alert.mockRestore();
  });
});
