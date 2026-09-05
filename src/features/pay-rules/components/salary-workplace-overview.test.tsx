import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { SalaryWorkplaceOverview } from '@/features/pay-rules/components/salary-workplace-overview';
import { useTranslation } from '@/shared/i18n';
import { createSalaryProfile } from '@/test/fixtures';
import { renderApp } from '@/test/render';

function LocaleButton() {
  const { setLocale } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>;
}

it('shows a compact bilingual setup summary and keeps numeric values LTR', () => {
  renderApp(<>
    <LocaleButton />
    <SalaryWorkplaceOverview
      onEdit={jest.fn()}
      onOpenSpecialPay={jest.fn()}
      overview={{ holidayIntervalCount: 2, holidayStatus: 'configured', overtimeStatus: 'configured', weeklyRestRateBasisPoints: 15_000, weeklyRestStatus: 'configured' }}
      profile={createSalaryProfile({ name: 'Main', baseHourlyRateMinor: 6_000, weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2_520, weeklyOvertimeMultiplierBasisPoints: 12_500 })}
      workplaceName="Cafe"
    />
  </>);

  expect(screen.getByText('אחרי 42 שעות בשבוע · 125%')).toBeTruthy();
  expect(screen.getByText('150% מהתעריף הבסיסי')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByText('‏60.00 ‏₪').props.style).writingDirection).toBe('ltr');

  fireEvent.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('After 42 weekly hours · 125%')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit salary settings' })).toBeTruthy();
});
