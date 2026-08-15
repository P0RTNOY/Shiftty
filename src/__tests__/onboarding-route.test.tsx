import { screen, waitFor } from '@testing-library/react-native';

import IndexScreen from '@/app';
import { renderApp } from '@/test/render';

const mockGetFirstAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({ getFirstAsync: mockGetFirstAsync }),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href) };
});

describe('onboarding launch route', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['true', '"true"'])('opens Home for completed setting %s', async (valueJson) => {
    mockGetFirstAsync.mockResolvedValue({ value_json: valueJson });

    renderApp(<IndexScreen />);

    await waitFor(() => expect(screen.getByText('/(tabs)')).toBeTruthy());
  });
});
