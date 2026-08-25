import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import OnboardingWorkplaceScreen from '@/app/onboarding/workplace';
import { renderApp } from '@/test/render';

const mockCreateInitialWorkplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));
jest.mock('@/domain/services', () => ({
  WorkplaceSetupService: jest.fn().mockImplementation(() => ({ createInitialWorkplace: mockCreateInitialWorkplace })),
}));
jest.mock('@/data/repositories/sqlite-workplace-repository', () => ({ SqliteWorkplaceRepository: jest.fn() }));
jest.mock('@/data/repositories/sqlite-salary-repositories', () => ({ SqliteSalaryProfileRepository: jest.fn() }));

describe('OnboardingWorkplaceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInitialWorkplace.mockResolvedValue({ workplaceId: 'workplace-1', profileId: 'profile-1' });
  });

  it('finishes onboarding and opens Home immediately after initial setup', async () => {
    renderApp(<OnboardingWorkplaceScreen />);

    expect(screen.getByLabelText('שם מקום העבודה')).toBeTruthy();
    expect(screen.getByLabelText('שכר שעתי (₪)')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('לדוגמה: בית קפה או מסעדה'), 'בית קפה');
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '60');
    fireEvent.press(screen.getByRole('button', { name: 'המשך' }));

    await waitFor(() => expect(mockCreateInitialWorkplace).toHaveBeenCalledWith({
      name: 'בית קפה',
      standardHourlyRateMinor: 6_000,
    }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(router.push).not.toHaveBeenCalledWith('/onboarding/finish');
  });
});
