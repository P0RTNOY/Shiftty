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

function EvidenceLocaleHarness({ result }: { result: typeof defaultResult }) {
  const { setLocale } = useTranslation();
  return <>
    <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>
    <SalaryTrustDisclosure result={result} status="finalized" />
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

  it('discloses frozen overlapping evidence, source provenance, pay effect, and no-rule behavior bilingually', () => {
    const segments = defaultResult.segments.map((segment, index) => index === 0 ? {
      ...segment,
      appliedRuleIds: [...segment.appliedRuleIds, 'holiday-rule'],
      multiplierBasisPoints: 15_000,
      specialIntervalIds: ['holiday-1', 'custom-1'],
    } : segment);
    const result = {
      ...defaultResult,
      segments,
      appliedRuleIds: [...defaultResult.appliedRuleIds, 'holiday-rule'],
      specialIntervalEvaluations: [
        {
          intervalId: 'holiday-1',
          type: 'holiday' as const,
          name: 'יום בדיקה',
          start: '2026-08-24T09:00:00+03:00',
          end: '2026-08-24T11:00:00+03:00',
          timezone: 'Asia/Jerusalem',
          sourceKind: 'confirmed_preset' as const,
          sourceTitle: 'Official date source',
          sourceUrl: 'https://example.gov/official-date',
          presetId: 'preset-date',
          presetVersion: '1',
          confirmedAt: '2026-08-20T10:00:00+03:00',
          appliedRuleIds: ['holiday-rule'],
          contributedToEstimate: true,
        },
        {
          intervalId: 'custom-1',
          type: 'custom' as const,
          name: 'Marker only',
          start: '2026-08-24T10:00:00+03:00',
          end: '2026-08-24T10:30:00+03:00',
          timezone: 'Asia/Jerusalem',
          sourceKind: 'manual' as const,
          confirmedAt: '2026-08-20T10:00:00+03:00',
          appliedRuleIds: [],
          contributedToEstimate: false,
        },
      ],
    };

    const { unmount } = renderApp(<EvidenceLocaleHarness result={result} />);
    fireEvent.press(screen.getByRole('button', { name: 'איך חושב הסכום?' }));

    expect(screen.getByText('חג: יום בדיקה')).toBeTruthy();
    expect(screen.getByText('מבוסס על מקור שאישרת')).toBeTruthy();
    expect(screen.getByText('כלל שכר שהוגדר באפליקציה')).toBeTruthy();
    expect(screen.getByText(/holiday-rule/)).toBeTruthy();
    expect(screen.getByText(/מכפיל משולב.*150/)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByTestId('salary-special-interval-range')[0]!.props.style).writingDirection).toBe('ltr');
    expect(screen.getByTestId('salary-special-interval-multiplier').props.children).toContain('\u2066150\u2069');
    expect(screen.getByText('זמן מיוחד: Marker only')).toBeTruthy();
    expect(screen.getByText('לא הוגדר כלל שכר — לא שינה את ההערכה')).toBeTruthy();
    expect(screen.getByText('https://example.gov/official-date')).toBeTruthy();
    expect(screen.getAllByTestId('salary-special-interval-detail')).toHaveLength(2);

    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Holiday: יום בדיקה')).toBeTruthy();
    expect(screen.getByText('Based on a source you confirmed')).toBeTruthy();
    expect(screen.getByText('Configured estimation rule')).toBeTruthy();
    expect(screen.getByText(/Combined multiplier.*150/)).toBeTruthy();
    expect(screen.getByText('No configured pay rule — did not change this estimate')).toBeTruthy();
    expect(screen.queryByText(/Legally verified|Guaranteed entitlement/)).toBeNull();

    unmount();
    renderApp(<SalaryTrustDisclosure result={result} status="stale" />);
    expect(screen.getByText('הערכת השכר אינה זמינה')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'איך חושב הסכום?' }));
    expect(screen.getByText('פרטי הקלט מהערכת השכר השמורה')).toBeTruthy();
    expect(screen.getByText('https://example.gov/official-date')).toBeTruthy();
  });
});
