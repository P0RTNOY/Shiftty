import { acceptCalendarEvidencePreset, IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET } from '@/domain/services';

describe('calendar evidence presets', () => {
  it('contains no pay effect and clones reviewed values into editable user evidence', () => {
    expect(IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET).not.toHaveProperty('multiplier');
    const accepted = acceptCalendarEvidencePreset({
      preset: IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET,
      intervalId: 'accepted-independence-day',
      workplaceId: 'workplace-1',
      salaryProfileId: 'profile-1',
      locale: 'en',
      confirmedAt: '2026-03-01T10:00:00+02:00',
    });
    expect(accepted).toMatchObject({
      id: 'accepted-independence-day', type: 'holiday', name: 'Independence Day — 2026',
      start: '2026-04-22T00:00:00+03:00', end: '2026-04-23T00:00:00+03:00',
      sourceKind: 'confirmed_preset', presetId: 'il-csc-independence-day-2026-date-only', presetVersion: '1',
    });
  });
});
