import { en, he } from '@/shared/i18n/translations';

describe('holiday and weekly-rest translations', () => {
  it('provides natural Hebrew and English settings, provenance, and no-pay-effect copy', () => {
    expect(he['salary.holidaysRestTitle']).toBe('חגים ומנוחה שבועית');
    expect(en['salary.holidaysRestTitle']).toBe('Holidays & weekly rest');
    expect(he['salary.specialIntervalManual']).toBe('הוגדר על ידך');
    expect(en['salary.specialIntervalManual']).toBe('User-confirmed input');
    expect(he['salary.specialIntervalNoRule']).toContain('לא שינה את ההערכה');
    expect(en['salary.specialIntervalNoRule']).toContain('did not change this estimate');
  });

  it('does not claim legal verification or entitlement in the new user-facing copy', () => {
    const milestoneValues = Object.entries(he).filter(([key]) => key.includes('specialInterval') || key.includes('holidaysRest') || key.includes('weeklyRest')).map(([, value]) => value);
    const englishValues = Object.entries(en).filter(([key]) => key.includes('specialInterval') || key.includes('holidaysRest') || key.includes('weeklyRest')).map(([, value]) => value);
    expect(milestoneValues.join(' ')).not.toMatch(/מגיע לך|מאומת משפטית|המעסיק חייב/);
    expect(englishValues.join(' ')).not.toMatch(/legally verified|guaranteed entitlement|employer must/i);
  });
});
