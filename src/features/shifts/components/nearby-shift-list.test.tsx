import { fireEvent, screen } from '@testing-library/react-native';
import { NearbyShiftList } from '@/features/shifts/components/nearby-shift-list';
import { renderApp } from '@/test/render';
import { createShift } from '@/test/fixtures';

it('renders multiple nearby shifts for explicit selection', () => {
  const onSelect = jest.fn();
  renderApp(<NearbyShiftList candidates={[createShift({ id: 'one' }), createShift({ id: 'two', scheduledStart: '2026-07-15T14:00:00+03:00', scheduledEnd: '2026-07-15T22:30:00+03:00' })]} onSelect={onSelect} workplaceNames={{ 'workplace-1': 'קפה העיר' }} />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  fireEvent.press(screen.getAllByRole('button')[1]!);
  expect(onSelect).toHaveBeenCalledWith('two');
});
