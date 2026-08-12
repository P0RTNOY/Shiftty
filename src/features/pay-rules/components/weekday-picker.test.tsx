import { fireEvent, screen } from '@testing-library/react-native';

import { WeekdayPicker } from '@/features/pay-rules/components/weekday-picker';
import { renderApp } from '@/test/render';

it('presents named weekdays instead of requiring numeric weekday codes', () => {
  const onChange = jest.fn();
  renderApp(<WeekdayPicker label="יום התחלה" onChange={onChange} value={5} />);

  expect(screen.getAllByRole('radio')).toHaveLength(7);
  expect(screen.getByRole('radio', { name: 'יום שישי' }).props.accessibilityState).toEqual({ checked: true });
  fireEvent.press(screen.getByRole('radio', { name: 'שבת' }));
  expect(onChange).toHaveBeenCalledWith(6);
  expect(screen.queryByDisplayValue('5')).toBeNull();
});
