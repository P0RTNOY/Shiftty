import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  WeeklyOvertimeSettings,
  weeklyHoursToMinutes,
  type WeeklyOvertimeSettingsValue,
} from '@/features/pay-rules/components/weekly-overtime-settings';
import { useTranslation } from '@/shared/i18n';
import { renderApp } from '@/test/render';

const initialValue: WeeklyOvertimeSettingsValue = {
  enabled: false,
  workweekStartWeekday: 0,
  regularHours: '42',
  multiplierPercent: '125',
  basis: 'net',
};

function Harness() {
  const [value, setValue] = useState(initialValue);
  const { setLocale } = useTranslation();
  return <>
    <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>
    <WeeklyOvertimeSettings value={value} onChange={setValue} />
  </>;
}

describe('WeeklyOvertimeSettings', () => {
  it('uses an explicit opt-in and accessible named weekdays', () => {
    renderApp(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'הפעלת שעות נוספות שבועיות' });
    expect(toggle.props.accessibilityState).toEqual({ checked: false });
    expect(screen.queryByLabelText('סף שעות רגילות בשבוע')).toBeNull();

    fireEvent(toggle, 'valueChange', true);
    expect(screen.getByLabelText('סף שעות רגילות בשבוע').props.value).toBe('42');
    expect(screen.getByLabelText('מכפיל לאחר הסף, באחוזים').props.value).toBe('125');
    expect(screen.getByRole('radio', { name: 'יום ראשון' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.queryByDisplayValue('0')).toBeNull();
  });

  it('switches between RTL and LTR layout with localized notices', () => {
    renderApp(<Harness />);
    expect(StyleSheet.flatten(screen.getByTestId('weekly-overtime-switch-row').props.style).flexDirection).toBe('row-reverse');

    fireEvent(screen.getByRole('switch', { name: 'הפעלת שעות נוספות שבועיות' }), 'valueChange', true);
    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Weekly overtime')).toBeTruthy();
    expect(screen.getByText(/not a guarantee of labor-law compliance/)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('weekly-overtime-switch-row').props.style).flexDirection).toBe('row');
  });

  it('converts displayed hours only when they resolve to exact positive minutes', () => {
    expect(weeklyHoursToMinutes('42')).toBe(2_520);
    expect(weeklyHoursToMinutes('42.5')).toBe(2_550);
    expect(weeklyHoursToMinutes('42.001')).toBeUndefined();
    expect(weeklyHoursToMinutes('0')).toBeUndefined();
    expect(weeklyHoursToMinutes('not-a-number')).toBeUndefined();
  });
});
