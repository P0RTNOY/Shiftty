import { screen } from '@testing-library/react-native';

import { DateField } from '@/shared/components/date-field';
import { renderApp } from '@/test/render';

describe('DateField', () => {
  it('shows the localized weekday as part of the selected shift date', () => {
    renderApp(<DateField label="תאריך" onChange={jest.fn()} value={new Date('2026-08-08T12:00:00+03:00')} />);

    expect(screen.getByText(/שבת/)).toBeTruthy();
  });
});
