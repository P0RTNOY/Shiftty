import DateTimePicker from '@react-native-community/datetimepicker';
import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DateField, TimeField } from '@/shared/components/date-field';
import { renderApp } from '@/test/render';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockDateTimePicker = (props: object) => React.createElement(View, props);
  return { __esModule: true, default: MockDateTimePicker };
});

describe('DateField', () => {
  it('shows the localized weekday as part of the selected shift date', () => {
    renderApp(<DateField label="תאריך" onChange={jest.fn()} value="2026-08-08" />);

    expect(screen.getByText('שבת, 8 באוגוסט 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'תאריך' })).toBeTruthy();
  });

  it('shows an honest empty state for an optional date instead of inventing a value', () => {
    renderApp(<DateField label="עד תאריך" onChange={jest.fn()} optional value={undefined} />);

    expect(screen.getByText('לא הוגדר')).toBeTruthy();
  });

  it('does not commit an Android picker value when the native dialog is dismissed', () => {
    const originalOs = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const onChange = jest.fn();

    try {
      renderApp(<DateField label="תאריך" onChange={onChange} value="2026-08-08" />);
      fireEvent.press(screen.getByRole('button', { name: 'תאריך' }));
      fireEvent(screen.UNSAFE_getByType(DateTimePicker), 'onChange', { type: 'dismissed' }, new Date(2026, 7, 9, 12));

      expect(onChange).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    }
  });
});

describe('TimeField', () => {
  it('shows a 24-hour time as a picker button without a text input', () => {
    renderApp(<TimeField label="כניסה" onChange={jest.fn()} value="08:05" />);

    expect(screen.getByText('08:05')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'כניסה' })).toBeTruthy();
    expect(screen.queryByDisplayValue('08:05')).toBeNull();
  });
});
