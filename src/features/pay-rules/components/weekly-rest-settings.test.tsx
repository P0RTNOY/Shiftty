import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { WeeklyRestSettings } from '@/features/pay-rules/components/weekly-rest-settings';
import { useTranslation } from '@/shared/i18n';
import { renderApp } from '@/test/render';

function Harness({ onSave = jest.fn() }: { onSave?: jest.Mock }) {
  const { setLocale } = useTranslation();
  const [key] = useState('stable');
  return <>
    <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>
    <WeeklyRestSettings
      key={key}
      previewFrom="2026-08-24T12:00:00+03:00"
      salaryProfileId="profile-1"
      timezone="Asia/Jerusalem"
      workplaceId="workplace-1"
      onSave={onSave}
    />
  </>;
}

describe('WeeklyRestSettings', () => {
  it('is disabled by default and progressively reveals a user-confirmed schedule', () => {
    const onSave = jest.fn();
    renderApp(<Harness onSave={onSave} />);

    const toggle = screen.getByRole('switch', { name: 'הפעלת מנוחה שבועית' });
    expect(toggle.props.accessibilityState).toEqual({ checked: false });
    expect(screen.queryByTestId('weekly-rest-fields')).toBeNull();

    fireEvent(toggle, 'valueChange', true);
    expect(screen.getByTestId('weekly-rest-preview')).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: 'יום שישי' }).some((item) => item.props.accessibilityState.checked)).toBe(true);
    const confirmation = screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ });
    expect(confirmation.props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByTestId('weekly-rest-confirmation-mark').props.children).toBe('');
    expect(screen.getByRole('button', { name: 'שמירת מנוחה שבועית' }).props.accessibilityState).toEqual({ disabled: true });

    fireEvent.press(screen.getAllByRole('radio', { name: 'יום ראשון' })[0]!);
    expect(screen.getAllByText('✓ א׳')[0]).toBeTruthy();
    fireEvent.press(confirmation);
    expect(screen.getByTestId('weekly-rest-confirmation-mark').props.children).toBe('✓');
    fireEvent.press(screen.getByRole('button', { name: 'שמירת מנוחה שבועית' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, startWeekday: 0, startTime: '18:00', endWeekday: 6, endTime: '18:00', confirmed: true }));
  });

  it('uses RTL and LTR switch-row layouts and keeps exact values directionally isolated', () => {
    renderApp(<Harness />);
    expect(StyleSheet.flatten(screen.getByTestId('weekly-rest-switch-row').props.style).flexDirection).toBe('row-reverse');
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Weekly rest')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('weekly-rest-switch-row').props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('weekly-rest-preview').props.style).writingDirection).toBe('ltr');
  });
});
