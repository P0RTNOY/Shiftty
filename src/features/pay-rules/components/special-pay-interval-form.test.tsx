import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SpecialPayIntervalForm } from '@/features/pay-rules/components/special-pay-interval-form';
import { renderApp } from '@/test/render';

describe('SpecialPayIntervalForm', () => {
  it('shows exact local boundaries and requires explicit confirmation before saving', () => {
    const onSave = jest.fn();
    renderApp(<SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" onSave={onSave} />);

    expect(screen.getByTestId('special-interval-preview')).toBeTruthy();
    expect(screen.getByText('Asia/Jerusalem')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'חג' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('✓ חג')).toBeTruthy();
    expect(screen.getByTestId('special-interval-confirmation-mark').props.children).toBe('');
    const save = screen.getByRole('button', { name: 'שמירת הטווח' });
    expect(save.props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText('שם הטווח'), 'ערב מיוחד');
    fireEvent.press(screen.getByRole('radio', { name: 'זמן מיוחד' }));
    expect(screen.getByText('✓ זמן מיוחד')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'קלט מיובא' }));
    fireEvent.changeText(screen.getByLabelText('כתובת המקור (רשות)'), 'https://example.gov/source');
    fireEvent.press(screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ }));
    expect(screen.getByTestId('special-interval-confirmation-mark').props.children).toBe('✓');
    fireEvent.press(save);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'custom', name: 'ערב מיוחד', sourceKind: 'imported', sourceUrl: 'https://example.gov/source',
      start: '2026-08-24T09:00:00.000+03:00', end: '2026-08-24T17:00:00.000+03:00', timezone: 'Asia/Jerusalem',
    }));
  });

  it('keeps source URLs LTR inside the Hebrew form', () => {
    renderApp(<SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" onSave={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByLabelText('כתובת המקור (רשות)').props.style).writingDirection).toBe('ltr');
    expect(StyleSheet.flatten(screen.getByLabelText('כתובת המקור (רשות)').props.style).borderWidth).toBe(1);
  });
});
