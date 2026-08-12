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

function ReminderMessage() {
  const { t } = useTranslation();
  return createElement(Text, null, t('notification.shiftReminderBody', { offsetMinutes: 30 }));
}

it('interpolates the shift reminder offset instead of exposing a placeholder', () => {
  renderApp(createElement(ReminderMessage));

  expect(screen.getByText('המשמרת שלך מתחילה בעוד 30 דקות.')).toBeTruthy();
  expect(screen.queryByText(/offsetMinutes/)).toBeNull();
});
