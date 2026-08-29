import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { buildManagedWeeklyRestPayRule } from '@/domain/services/weekly-rest-pay-rule-service';
import { WeeklyRestSettings } from '@/features/pay-rules/components/weekly-rest-settings';
import { useTranslation } from '@/shared/i18n';
import { createWeeklyRestSchedule } from '@/test/fixtures';
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

function PayRuleRefreshHarness() {
  const schedule = createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' });
  const initial = buildManagedWeeklyRestPayRule({
    salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest',
    timestamp: '2026-08-28T17:00:00+03:00',
  });
  const [rule, setRule] = useState(initial);
  return <>
    <Pressable accessibilityRole="button" onPress={() => setRule(buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1', multiplierBasisPoints: 12_500, name: 'Rest',
      timestamp: '2026-08-29T17:00:00+03:00', existing: initial,
    }))}><Text>Refresh rate</Text></Pressable>
    <WeeklyRestSettings
      key={rule.updatedAt}
      managedPayRule={rule}
      onSave={jest.fn()}
      onSavePayRule={jest.fn()}
      salaryProfileId="profile-1"
      schedule={schedule}
      timezone="Asia/Jerusalem"
      workplaceId="workplace-1"
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

  it('keeps the workplace window dynamic and saves an explicit total pay rate separately', () => {
    const onSavePayRule = jest.fn();
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5,
      startTime: '18:00',
      endWeekday: 0,
      endTime: '18:00',
      enabled: true,
      confirmedAt: '2026-08-28T17:00:00+03:00',
    });
    renderApp(<WeeklyRestSettings
      onSave={jest.fn()}
      onSavePayRule={onSavePayRule}
      previewFrom="2026-08-24T12:00:00+03:00"
      salaryProfileId="profile-1"
      schedule={schedule}
      timezone="Asia/Jerusalem"
      workplaceId="workplace-1"
    />);

    expect(screen.getAllByRole('radio', { name: 'יום שישי' }).some((item) => item.props.accessibilityState.checked)).toBe(true);
    expect(screen.getAllByRole('radio', { name: 'יום ראשון' }).some((item) => item.props.accessibilityState.checked)).toBe(true);
    expect(screen.getByText(/עדיין אין לו כלל תשלום/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'שמירת תעריף מנוחה שבועית' }).props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText('תעריף כולל במנוחה השבועית (%)'), '150');
    fireEvent.press(screen.getByRole('button', { name: 'שמירת תעריף מנוחה שבועית' }));

    expect(onSavePayRule).toHaveBeenCalledWith(15_000);
  });

  it('refreshes the simple percentage when an advanced edit changes the managed rule', () => {
    renderApp(<PayRuleRefreshHarness />);
    expect(screen.getByLabelText('תעריף כולל במנוחה השבועית (%)').props.value).toBe('150');

    fireEvent.press(screen.getByRole('button', { name: 'Refresh rate' }));

    expect(screen.getByLabelText('תעריף כולל במנוחה השבועית (%)').props.value).toBe('125');
  });

  it('shows a disabled managed-ID rule as advanced and never offers a silent re-enable', () => {
    const schedule = createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' });
    const disabled = {
      ...buildManagedWeeklyRestPayRule({
        salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest',
        timestamp: '2026-08-28T17:00:00+03:00',
      }),
      isEnabled: false,
    };
    renderApp(<WeeklyRestSettings
      advancedPayRules={[disabled]}
      managedRuleBlocked
      onOpenAdvancedRules={jest.fn()}
      onSave={jest.fn()}
      onSavePayRule={jest.fn()}
      salaryProfileId="profile-1"
      schedule={schedule}
      timezone="Asia/Jerusalem"
      workplaceId="workplace-1"
    />);

    expect(screen.getByRole('alert', { name: /הכלל מושבת או משתמש בהגדרות מתקדמות/ })).toBeTruthy();
    expect(screen.getByText(/Rest · 150% · מושבת/)).toBeTruthy();
    expect(screen.queryByTestId('e2e-weekly-rest-pay-multiplier')).toBeNull();
  });
});
