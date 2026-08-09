import { en, he } from './translations';

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
