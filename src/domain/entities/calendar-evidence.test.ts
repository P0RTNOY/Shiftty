import { calendarEvidenceIntervalSchema, payRuleSchema, weeklyRestScheduleSchema } from '@/domain/entities';
import { createCalendarEvidenceInterval, createPayRule, createWeeklyRestSchedule } from '@/test/fixtures';

describe('calendar evidence entities', () => {
  it('accepts a bounded confirmed manual interval', () => {
    expect(createCalendarEvidenceInterval()).toMatchObject({
      type: 'holiday', sourceKind: 'manual', isArchived: false, timezone: 'Asia/Jerusalem',
    });
  });

  it('rejects zero/reversed ranges, invalid timezones, unsafe URLs, and unbounded names', () => {
    const base = createCalendarEvidenceInterval();
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, end: base.start })).toThrow('after');
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, timezone: 'Not/A_Zone' })).toThrow('IANA');
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, sourceUrl: 'file:///private/source' })).toThrow('HTTP');
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, name: 'x'.repeat(121) })).toThrow();
  });

  it('requires complete preset and archive provenance', () => {
    const base = createCalendarEvidenceInterval();
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, sourceKind: 'confirmed_preset' })).toThrow('ID and version');
    expect(() => calendarEvidenceIntervalSchema.parse({ ...base, isArchived: true })).toThrow('archive timestamp');
  });
});

describe('special-interval pay-rule compatibility', () => {
  it('accepts generalized interval types and an explicit premium family', () => {
    expect(createPayRule({
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday', 'weekly_rest'] }],
      premiumFamily: 'special_interval',
    })).toMatchObject({ premiumFamily: 'special_interval' });
  });

  it('rejects duplicate/empty generalized types and keeps legacy conditions readable', () => {
    const base = createPayRule();
    expect(() => payRuleSchema.parse({ ...base, conditions: [{ type: 'specialInterval', intervalTypes: [] }] })).toThrow();
    expect(() => payRuleSchema.parse({ ...base, conditions: [{ type: 'specialInterval', intervalTypes: ['holiday', 'holiday'] }] })).toThrow('unique');
    expect(payRuleSchema.parse({ ...base, conditions: [{ type: 'holiday' }] }).premiumFamily).toBeUndefined();
    expect(payRuleSchema.parse({ ...base, conditions: [{ type: 'weekend', startWeekday: 5, startTime: '18:00', endWeekday: 6, endTime: '18:00' }] }).premiumFamily).toBeUndefined();
  });
});

describe('weekly-rest schedule entity', () => {
  it('is disabled and unconfirmed by default', () => {
    const schedule = createWeeklyRestSchedule();
    const { enabled: _enabled, ...withoutEnabled } = schedule;
    const parsed = weeklyRestScheduleSchema.parse(withoutEnabled);
    expect(parsed.enabled).toBe(false);
    expect(parsed.confirmedAt).toBeUndefined();
  });

  it('requires confirmation before enabling and rejects a zero weekly range', () => {
    const disabled = createWeeklyRestSchedule();
    expect(() => weeklyRestScheduleSchema.parse({ ...disabled, enabled: true })).toThrow('user-confirmed');
    expect(() => weeklyRestScheduleSchema.parse({ ...disabled, endWeekday: disabled.startWeekday, endTime: disabled.startTime })).toThrow('differ');
  });
});
