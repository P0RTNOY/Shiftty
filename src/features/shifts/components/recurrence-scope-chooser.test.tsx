import { fireEvent, screen } from '@testing-library/react-native';

import { RecurrenceScopeChooser } from '@/features/shifts/components/recurrence-scope-chooser';
import { renderApp } from '@/test/render';

it('offers all recurrence scopes as accessible actions', () => {
  const onChoose = jest.fn();
  renderApp(<RecurrenceScopeChooser onChoose={onChoose} onDismiss={jest.fn()} visible />);
  fireEvent.press(screen.getByRole('button', { name: 'המשמרת הזאת והבאות' }));
  expect(onChoose).toHaveBeenCalledWith('future');
  expect(screen.getByRole('button', { name: 'כל הסדרה' })).toBeTruthy();
});
