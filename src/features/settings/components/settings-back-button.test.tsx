import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderApp } from '@/test/render';
import { SettingsBackButton } from './settings-back-button';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

describe('SettingsBackButton', () => {
  it('returns to the previous settings screen', () => {
    renderApp(<SettingsBackButton />);

    fireEvent.press(screen.getByRole('button', { name: 'חזרה' }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
