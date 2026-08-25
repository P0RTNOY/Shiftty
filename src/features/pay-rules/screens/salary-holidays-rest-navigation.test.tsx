import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SalaryProfilesScreen from '@/app/settings/salary';
import { createSalaryProfile } from '@/test/fixtures';
import { renderApp } from '@/test/render';

let mockFocusInvoked = false;
const mockProfile = createSalaryProfile({ name: 'שכר עיקרי' });
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void) => { if (!mockFocusInvoked) { mockFocusInvoked = true; callback(); } },
}));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({
    salaryProfiles: {
      create: jest.fn(), update: jest.fn(), createVersion: jest.fn(),
      listByWorkplace: jest.fn().mockResolvedValue([mockProfile]),
    },
    workplaces: { save: jest.fn() },
  }),
}));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({
  useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה העיר', salaryProfileId: 'profile-1' }], refresh: jest.fn() }),
}));

it('opens Holidays & weekly rest from a persisted salary profile without expanding hourly setup', async () => {
  jest.clearAllMocks();
  mockFocusInvoked = false;
  renderApp(<SalaryProfilesScreen />);
  await screen.findByText('שכר עיקרי');

  expect(screen.queryByText('שעות נוספות שבועיות')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'חגים ומנוחה שבועית' }));
  expect(router.push).toHaveBeenCalledWith('/settings/salary/holidays-rest?profileId=profile-1');
});
