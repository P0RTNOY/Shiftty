import { ScrollView, Text } from 'react-native';
import { screen } from '@testing-library/react-native';

import { AppScreen } from '@/shared/components/app-screen';
import { renderApp } from '@/test/render';

it('can leave vertical scrolling to a virtualized child list', () => {
  renderApp(
    <AppScreen scrollable={false} title="מסך">
      <Text>תוכן</Text>
    </AppScreen>,
  );

  expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
  expect(screen.getByText('תוכן')).toBeTruthy();
});

it('remains vertically scrollable by default', () => {
  renderApp(
    <AppScreen title="מסך">
      <Text>תוכן</Text>
    </AppScreen>,
  );

  expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
});
