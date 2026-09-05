import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { buildManagedWeeklyRestPayRule } from '@/domain/services/weekly-rest-pay-rule-service';
import { WeeklyRestSettings } from '@/features/pay-rules/components/weekly-rest-settings';
import { useTranslation } from '@/shared/i18n';
import { createWeeklyRestSchedule } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const commonProps = {
  previewFrom: '2026-08-24T12:00:00+03:00',
  salaryProfileId: 'profile-1',
  timezone: 'Asia/Jerusalem',
  workplaceId: 'workplace-1',
};

function LocaleButton() {
  const { setLocale } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>;
}

describe('WeeklyRestSettings', () => {
  it('requires one explicit pay choice and submits the confirmed window and total rate together', async () => {
    const onSave = jest.fn();
    renderApp(<WeeklyRestSettings {...commonProps} onSave={onSave} />);

    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }).props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(screen.getByRole('radio', { name: 'תשלום בתעריף מיוחד' }));
    fireEvent.changeText(screen.getByLabelText('תעריף כולל במנוחה השבועית (%)'), '150');
    fireEvent.press(screen.getAllByRole('radio', { name: 'יום ראשון' })[1]!);
    fireEvent.press(screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true,
        startWeekday: 5,
        startTime: '18:00',
        endWeekday: 0,
        endTime: '18:00',
        confirmed: true,
        payChoice: { kind: 'managed_rate', multiplierBasisPoints: 15_000 },
      }));
    });
    expect(screen.queryByTestId('e2e-weekly-rest-pay-save')).toBeNull();
  });

  it('allows an explicit tracking-only configuration through the same save', async () => {
    const onSave = jest.fn();
    renderApp(<WeeklyRestSettings {...commonProps} onSave={onSave} />);

    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    fireEvent.press(screen.getByRole('radio', { name: 'מעקב בלבד, ללא תוספת בסיסית' }));
    fireEvent.press(screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ payChoice: { kind: 'tracking_only' } }));
    });
  });

  it('updates an existing managed rate without requiring interval reconfirmation', async () => {
    const onSave = jest.fn();
    const schedule = createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' });
    const managedPayRule = buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest', timestamp: '2026-08-28T17:00:00+03:00',
    });
    renderApp(<WeeklyRestSettings {...commonProps} managedPayRule={managedPayRule} onSave={onSave} schedule={schedule} />);

    expect(screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ }).props.accessibilityState).toEqual({ checked: true });
    fireEvent.changeText(screen.getByLabelText('תעריף כולל במנוחה השבועית (%)'), '125');
    fireEvent.press(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        confirmed: true,
        payChoice: { kind: 'managed_rate', multiplierBasisPoints: 12_500 },
      }));
    });
  });

  it('invalidates confirmation when the weekly-rest window changes', () => {
    const schedule = createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' });
    renderApp(<WeeklyRestSettings {...commonProps} onSave={jest.fn()} schedule={schedule} />);

    const confirmation = screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ });
    expect(confirmation.props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(screen.getAllByRole('radio', { name: 'יום ראשון' })[0]!);
    expect(screen.getByRole('checkbox', { name: /בדקתי ואישרתי/ }).props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }).props.accessibilityState).toEqual({ disabled: true });
  });

  it('preserves an incompatible managed-ID rule and keeps bilingual directional layout', async () => {
    const onSave = jest.fn();
    const schedule = createWeeklyRestSchedule({ enabled: true, confirmedAt: '2026-08-28T17:00:00+03:00' });
    const disabled = {
      ...buildManagedWeeklyRestPayRule({
        salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest', timestamp: '2026-08-28T17:00:00+03:00',
      }),
      isEnabled: false,
    };
    renderApp(<>
      <LocaleButton />
      <WeeklyRestSettings
        {...commonProps}
        advancedPayRules={[disabled]}
        managedRuleBlocked
        onOpenAdvancedRules={jest.fn()}
        onSave={onSave}
        schedule={schedule}
      />
    </>);

    expect(screen.queryByTestId('e2e-weekly-rest-pay-multiplier')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('weekly-rest-switch-row').props.style).flexDirection).toBe('row-reverse');
    fireEvent.press(screen.getByRole('button', { name: 'שמירת הגדרות המנוחה השבועית' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ payChoice: { kind: 'advanced_preserved' } }));
    });

    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Weekly rest')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('weekly-rest-switch-row').props.style).flexDirection).toBe('row');
  });
});
