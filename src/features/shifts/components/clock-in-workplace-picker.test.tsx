import { fireEvent, screen } from '@testing-library/react-native';

import { ClockInWorkplacePicker } from '@/features/shifts/components/clock-in-workplace-picker';
import { renderApp } from '@/test/render';

const workplaces = [
  {
    id: 'workplace-1',
    name: 'קפה העיר',
    defaultHourlyRateMinor: 4_500,
    defaultBreakMinutes: 30,
    createdAt: '2026-01-01T00:00:00+02:00',
    updatedAt: '2026-01-01T00:00:00+02:00',
  },
  {
    id: 'workplace-2',
    name: 'הסניף השני',
    defaultHourlyRateMinor: 5_000,
    defaultBreakMinutes: 20,
    createdAt: '2026-01-01T00:00:00+02:00',
    updatedAt: '2026-01-01T00:00:00+02:00',
  },
];

describe('ClockInWorkplacePicker', () => {
  it('returns the selected workplace without exposing setup fields', () => {
    const onChoose = jest.fn();
    renderApp(<ClockInWorkplacePicker busy={false} onCancel={jest.fn()} onChoose={onChoose} workplaces={workplaces} />);

    expect(screen.getByText('איפה עובדים עכשיו?')).toBeTruthy();
    expect(screen.queryByText('4,500')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'הסניף השני' }));
    expect(onChoose).toHaveBeenCalledWith('workplace-2');
  });
});
