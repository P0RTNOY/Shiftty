import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SettingsScreen from '@/app/(tabs)/settings';
import ReportsBackupScreen from '@/app/settings/reports-backup';
import { renderApp } from '@/test/render';

const mockClearPredictions = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({ predictionFeedback: { clearAll: mockClearPredictions } }),
}));

beforeEach(() => jest.clearAllMocks());

it('shows five functional primary settings rows and no dead language row', () => {
  renderApp(<SettingsScreen />);

  expect(screen.getByRole('button', { name: 'מקומות עבודה' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'שכר' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'תבניות משמרת' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'התראות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'דוחות וגיבוי' })).toBeTruthy();
  expect(screen.getByText('הגדרות מתקדמות')).toBeTruthy();
  expect(screen.queryByText('שפה ואזור זמן')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'דוחות וגיבוי' }));
  expect(router.push).toHaveBeenCalledWith('/settings/reports-backup');
});

it('routes report exports and backup management through the combined hub', () => {
  renderApp(<ReportsBackupScreen />);

  fireEvent.press(screen.getByRole('button', { name: 'ייצוא דוחות' }));
  expect(router.push).toHaveBeenCalledWith('/settings/exports');
  fireEvent.press(screen.getByRole('button', { name: 'גיבוי ושחזור' }));
  expect(router.push).toHaveBeenCalledWith('/settings/data-management');
});
