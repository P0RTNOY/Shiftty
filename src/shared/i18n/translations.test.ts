import { en, he } from './translations';
import { screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { renderApp } from '@/test/render';

describe('settings translations', () => {
  it('provides localized labels for every data and privacy route', () => {
    expect(he['settings.exports']).toBe('ייצוא דוחות');
    expect(he['settings.privacy']).toBe('פרטיות');
    expect(he['settings.dataManagement']).toBe('ניהול נתונים');
    expect(en['settings.exports']).toBe('Report exports');
    expect(en['settings.privacy']).toBe('Privacy');
    expect(en['settings.dataManagement']).toBe('Data management');
  });
});

it('keeps empty-state copy focused on visible worker outcomes', () => {
  expect(he['home.noNextShiftBody']).toBe('אפשר להוסיף משמרת מתוכננת והיא תופיע כאן.');
  expect(he['reports.emptyBody']).toBe('לאחר השלמת משמרת יוצגו כאן השעות והשכר.');
});

it('uses ordinary clock-in and clock-out language in the core shift flow', () => {
  expect(he['active.actualStart']).toBe('כניסה');
  expect(he['end.actualEndDate']).toBe('תאריך');
  expect(he['end.actualEndTime']).toBe('יציאה');
});

function ReminderMessage() {
  const { t } = useTranslation();
  return createElement(Text, null, t('notification.shiftReminderBody', { offsetMinutes: 30 }));
}

it('interpolates the shift reminder offset instead of exposing a placeholder', () => {
  renderApp(createElement(ReminderMessage));

  expect(screen.getByText('המשמרת שלך מתחילה בעוד 30 דקות.')).toBeTruthy();
  expect(screen.queryByText(/offsetMinutes/)).toBeNull();
});

it('provides natural shift reminder copy for now and one minute', () => {
  const hebrew = he as Record<string, string>;
  const english = en as Record<string, string>;

  expect(hebrew['notification.shiftReminderBodyNow']).toBe('המשמרת שלך מתחילה עכשיו.');
  expect(hebrew['notification.shiftReminderBodyOne']).toBe('המשמרת שלך מתחילה בעוד דקה.');
  expect(english['notification.shiftReminderBodyNow']).toBe('Your shift starts now.');
  expect(english['notification.shiftReminderBodyOne']).toBe('Your shift starts in one minute.');
});
