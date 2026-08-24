import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { calculateSalary } from '@/domain/services';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { useTranslation } from '@/shared/i18n';
import { createSalaryProfile, createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const defaultResult = calculateSalary({
  shift: createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 }),
  profile: createSalaryProfile({ baseHourlyRateMinor: 6_000 }),
  rules: [],
  breaks: [],
  holidayIntervals: [],
  calculatedAt: '2026-08-24T12:00:00+03:00',
});

function LocaleHarness() {
  const { setLocale } = useTranslation();
  return <>
    <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>
    <SalaryTrustDisclosure mode="generic" />
  </>;
}

describe('SalaryTrustDisclosure', () => {
  it('uses accessible progressive disclosure in Hebrew RTL and English LTR', () => {
    renderApp(<LocaleHarness />);
    const hebrewDisclosure = screen.getByRole('button', { name: 'איך חושב הסכום?' });
    expect(hebrewDisclosure.props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(hebrewDisclosure);
    expect(screen.getByText('מה נכלל בחישוב')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByTestId('salary-assumption-row')[0]!.props.style).flexDirection).toBe('row-reverse');

    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Included in the calculation')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByTestId('salary-assumption-row')[0]!.props.style).flexDirection).toBe('row');
    expect(screen.getByRole('button', { name: 'Hide calculation details' }).props.accessibilityState).toEqual({ expanded: true });
  });

  it('shows the calm default-overtime explanation and opens salary settings', () => {
    const onOpenSalarySettings = jest.fn();
    renderApp(<SalaryTrustDisclosure onOpenSalarySettings={onOpenSalarySettings} result={defaultResult} status="estimated" />);

    expect(screen.getByText('הערכת שכר בסיסית')).toBeTruthy();
    expect(screen.getByText(/8 שעות רגילות, שעתיים ב־125% ושעתיים ב־150%/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'פתיחת הגדרות שכר' }));
    expect(onOpenSalarySettings).toHaveBeenCalledTimes(1);
  });

  it('moves successfully evaluated weekly overtime into the included assumptions', () => {
    const weeklyResult = {
      ...defaultResult,
      explanations: [
        ...defaultResult.explanations,
        'salary.explanations.weekly_overtime:system-weekly-overtime:profile-1:2520:12500:net',
      ],
    };
    renderApp(<SalaryTrustDisclosure result={weeklyResult} status="estimated" />);

    expect(screen.getByText('הערכת שכר לפי ההגדרות שלך')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'איך חושב הסכום?' }));
    expect(screen.getByText('סף השעות הנוספות השבועי שהוגדר')).toBeTruthy();
    expect(screen.queryByText('ספי שעות נוספות שבועיים')).toBeNull();
  });
});
