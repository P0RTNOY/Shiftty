import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { SpecialPayIntervalForm } from '@/features/pay-rules/components/special-pay-interval-form';
import { useTranslation } from '@/shared/i18n';
import { renderApp } from '@/test/render';

function LocaleButton() {
  const { setLocale } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>;
}

describe('SpecialPayIntervalForm', () => {
  it('shows exact local boundaries and saves the interval and rate with one confirmation action', async () => {
    const onSave = jest.fn();
    renderApp(<SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" onSave={onSave} />);

    expect(screen.getByTestId('special-interval-preview')).toBeTruthy();
    expect(screen.getByText('Asia/Jerusalem')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'חג' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('✓ חג')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'שמירה ואישור' });
    expect(save.props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText('שם הטווח'), 'ערב מיוחד');
    fireEvent.press(screen.getByRole('radio', { name: 'זמן מיוחד' }));
    expect(screen.getByText('✓ זמן מיוחד')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('תעריף כולל בזמן המיוחד (%)'), '175');
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות מתקדמות' }));
    fireEvent.press(screen.getByRole('radio', { name: 'קלט מיובא' }));
    fireEvent.changeText(screen.getByLabelText('כתובת המקור (רשות)'), 'https://example.gov/source');
    fireEvent.press(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'custom', name: 'ערב מיוחד', sourceKind: 'imported', sourceUrl: 'https://example.gov/source',
      start: '2026-08-24T09:00:00.000+03:00', end: '2026-08-24T17:00:00.000+03:00', timezone: 'Asia/Jerusalem',
      payChoice: { kind: 'managed_rate', multiplierBasisPoints: 17_500 },
    })));
  });

  it('keeps source URLs LTR inside the Hebrew form', () => {
    renderApp(<SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" onSave={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות מתקדמות' }));
    expect(StyleSheet.flatten(screen.getByLabelText('כתובת המקור (רשות)').props.style).writingDirection).toBe('ltr');
    expect(StyleSheet.flatten(screen.getByLabelText('כתובת המקור (רשות)').props.style).borderWidth).toBe(1);
  });

  it('can reuse the configured weekly-rest rate without duplicating input', async () => {
    const onSave = jest.fn();
    renderApp(<SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" weeklyRestRateBasisPoints={15_000} onSave={onSave} />);
    fireEvent.changeText(screen.getByLabelText('שם הטווח'), 'חג');
    fireEvent.press(screen.getByRole('checkbox', { name: 'שימוש בתעריף המנוחה השבועית (150%)' }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירה ואישור' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      payChoice: { kind: 'managed_rate', multiplierBasisPoints: 15_000 },
    })));
  });

  it('keeps the simplified save flow usable in English', () => {
    renderApp(<>
      <LocaleButton />
      <SpecialPayIntervalForm now="2026-08-24T12:00:00+03:00" timezone="Asia/Jerusalem" onSave={jest.fn()} />
    </>);

    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByLabelText('Interval name')).toBeTruthy();
    expect(screen.getByLabelText('Total special-time rate (%)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save and confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Advanced options' })).toBeTruthy();
  });
});
