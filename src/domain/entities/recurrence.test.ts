import { recurrenceRuleSchema } from '@/domain/entities/recurrence';

describe('recurrenceRuleSchema', () => {
  it('accepts bounded and open-ended weekly rules', () => {
    expect(
      recurrenceRuleSchema.parse({
        id: 'rule-1',
        frequency: 'weekly',
        weekdays: [0, 2],
        startsOn: '2026-08-02',
        occurrenceLimit: 10,
        timezone: 'Asia/Jerusalem',
      }),
    ).toMatchObject({ weekdays: [0, 2] });
  });

  it('rejects duplicate weekdays and an end before the start', () => {
    expect(() =>
      recurrenceRuleSchema.parse({
        id: 'rule-1',
        frequency: 'weekly',
        weekdays: [1, 1],
        startsOn: '2026-08-02',
        timezone: 'Asia/Jerusalem',
      }),
    ).toThrow();
    expect(() =>
      recurrenceRuleSchema.parse({
        id: 'rule-1',
        frequency: 'weekly',
        weekdays: [1],
        startsOn: '2026-08-02',
        endsOn: '2026-08-01',
        timezone: 'Asia/Jerusalem',
      }),
    ).toThrow();
  });
});
