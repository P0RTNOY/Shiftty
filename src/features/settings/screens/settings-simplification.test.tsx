import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { useTranslation } from '@/shared/i18n';
import { renderApp } from '@/test/render';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

beforeEach(() => jest.clearAllMocks());

function LocaleButton() {
  const { setLocale } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>;
}

it('shows exactly four plain-language destinations on the settings root', () => {
  renderApp(<SettingsScreen />);

  expect(screen.getByRole('button', { name: 'מקומות עבודה' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'שכר ותוספות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'התראות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'נתונים וגיבוי' })).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(4);
  expect(screen.getByTestId('e2e-settings-notifications')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'סוגי משמרת' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'ייצוא דוחות' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'נתונים וגיבוי' }));
  expect(router.push).toHaveBeenCalledWith('/settings/data');
});

it('keeps the four destinations plain and complete in English', () => {
  renderApp(<><LocaleButton /><SettingsScreen /></>);
  fireEvent.press(screen.getByRole('button', { name: 'English' }));

  expect(screen.getByRole('button', { name: 'Workplaces' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Salary & premiums' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Data & backup' })).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(5);
});
