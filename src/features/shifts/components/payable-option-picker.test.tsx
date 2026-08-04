import { fireEvent, screen } from '@testing-library/react-native';
import { PayableOptionPicker } from '@/features/shifts/components/payable-option-picker';
import { renderApp } from '@/test/render';

it('offers actual, scheduled, rounded and manual payable choices', () => {
  const onChange = jest.fn();
  renderApp(<PayableOptionPicker hasScheduledRange onChange={onChange} value="actual" />);
  for (const label of ['השתמש בשעות בפועל', 'השתמש בשעות המתוכננות', 'עיגול זמנים', 'עריכה ידנית']) expect(screen.getByRole('radio', { name: label })).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'עריכה ידנית' }));
  expect(onChange).toHaveBeenCalledWith('manual');
});

it('disables scheduled time when it is unavailable', () => {
  renderApp(<PayableOptionPicker hasScheduledRange={false} onChange={jest.fn()} value="actual" />);
  expect(screen.getByRole('radio', { name: 'השתמש בשעות המתוכננות' })).toBeDisabled();
});
