import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SettingsScreen from '@/app/(tabs)/settings';
import { renderApp } from '@/test/render';

const mockClearPredictions = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({ predictionFeedback: { clearAll: mockClearPredictions } }),
}));

beforeEach(() => jest.clearAllMocks());

it('links exports and backup directly from the primary settings list', () => {
  renderApp(<SettingsScreen />);

  expect(screen.getByRole('button', { name: 'מקומות עבודה' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'שכר' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'סוגי משמרת' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'התראות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ייצוא דוחות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'גיבוי ושחזור' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'דוחות וגיבוי' })).toBeNull();
  expect(screen.getByText('הגדרות מתקדמות')).toBeTruthy();
  expect(screen.queryByText('שפה ואזור זמן')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'ייצוא דוחות' }));
  expect(router.push).toHaveBeenCalledWith('/settings/exports');
  fireEvent.press(screen.getByRole('button', { name: 'גיבוי ושחזור' }));
  expect(router.push).toHaveBeenCalledWith('/settings/data-management');
});
