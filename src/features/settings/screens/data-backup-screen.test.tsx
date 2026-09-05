import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import DataBackupScreen from '@/app/settings/data';
import { renderApp } from '@/test/render';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({ useRepositories: () => ({ predictionFeedback: { clearAll: jest.fn() } }) }));

it('keeps exports, backup, privacy, and destructive data actions in the data hub', () => {
  renderApp(<DataBackupScreen />);
  expect(screen.getByRole('button', { name: 'ייצוא דוחות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'גיבוי ושחזור' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'פרטיות' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ניקוי היסטוריית הצעות חכמות' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'ייצוא דוחות' }));
  expect(router.push).toHaveBeenCalledWith('/settings/exports');
  fireEvent.press(screen.getByRole('button', { name: 'גיבוי ושחזור' }));
  expect(router.push).toHaveBeenCalledWith('/settings/data-management');
});
