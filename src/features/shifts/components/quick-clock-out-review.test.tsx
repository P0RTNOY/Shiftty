import { fireEvent, screen } from '@testing-library/react-native';

import { QuickClockOutReview } from '@/features/shifts/components/quick-clock-out-review';
import { renderApp } from '@/test/render';
import { createBreak, createShift } from '@/test/fixtures';

describe('QuickClockOutReview', () => {
  it('shows the simple review and exposes save and advanced edit actions', () => {
    const onSave = jest.fn();
    const onEdit = jest.fn();
    renderApp(<QuickClockOutReview
      actualEnd="2026-07-15T17:00:00+03:00"
      breaks={[createBreak({ start: '2026-07-15T15:00:00+03:00', end: '2026-07-15T15:30:00+03:00' })]}
      busy={false}
      estimatedPay="₪157.50"
      onCancel={jest.fn()}
      onEdit={onEdit}
      onSave={onSave}
      shift={createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00' })}
    />);

    expect(screen.getByText('סיימת משמרת')).toBeTruthy();
    expect(screen.getByText('₪157.50')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'שמור' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'עריכת פרטים' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows the localized weekday and date in the clock-out summary', () => {
    renderApp(<QuickClockOutReview
      actualEnd="2026-08-08T17:00:00+03:00"
      breaks={[]}
      busy={false}
      onCancel={jest.fn()}
      onEdit={jest.fn()}
      onSave={jest.fn()}
      shift={createShift({ status: 'active', scheduledStart: undefined, scheduledEnd: undefined, actualStart: '2026-08-08T13:00:00+03:00' })}
    />);

    expect(screen.getByText(/שבת/)).toBeTruthy();
  });
});
