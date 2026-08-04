import type { RecurrenceSeries } from '@/domain/entities/recurrence';
import {
  generateRecurrenceOccurrences,
  planRecurrenceEdit,
} from '@/domain/services/recurrence-service';

const series: RecurrenceSeries = {
  id: 'series-1',
  rule: {
    id: 'rule-1',
    frequency: 'weekly',
    weekdays: [0, 2],
    startsOn: '2026-08-02',
    timezone: 'Asia/Jerusalem',
  },
  template: {
    workplaceId: 'workplace-1',
    startTime: '13:30',
    endTime: '22:00',
    expectedBreakMinutes: 30,
    hourlyRateSnapshotMinor: 4500,
  },
  createdAt: '2026-08-01T10:00:00+03:00',
  updatedAt: '2026-08-01T10:00:00+03:00',
};

describe('generateRecurrenceOccurrences', () => {
  it('generates selected weekdays with stable, idempotent identities', () => {
    const first = generateRecurrenceOccurrences(series, '2026-08-01', '2026-08-16');
    const second = generateRecurrenceOccurrences(series, '2026-08-01', '2026-08-16');

    expect(first.map((item) => item.localDate)).toEqual([
      '2026-08-02',
      '2026-08-04',
      '2026-08-09',
      '2026-08-11',
      '2026-08-16',
    ]);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it('supports biweekly rules', () => {
    const occurrences = generateRecurrenceOccurrences(
      { ...series, rule: { ...series.rule, frequency: 'biweekly', weekdays: [0] } },
      '2026-08-01',
      '2026-08-31',
    );

    expect(occurrences.map((item) => item.localDate)).toEqual(['2026-08-02', '2026-08-16', '2026-08-30']);
  });

  it('honors end dates and occurrence limits', () => {
    const ended = generateRecurrenceOccurrences(
      { ...series, rule: { ...series.rule, endsOn: '2026-08-10' } },
      '2026-08-01',
      '2026-09-30',
    );
    const limited = generateRecurrenceOccurrences(
      { ...series, rule: { ...series.rule, occurrenceLimit: 3 } },
      '2026-08-01',
      '2026-09-30',
    );

    expect(ended).toHaveLength(3);
    expect(limited).toHaveLength(3);
  });

  it('skips persisted occurrences and deleted or modified exceptions', () => {
    const occurrences = generateRecurrenceOccurrences(series, '2026-08-01', '2026-08-16', {
      existingLocalDates: ['2026-08-02'],
      exceptionLocalDates: ['2026-08-04'],
    });

    expect(occurrences.map((item) => item.localDate)).toEqual(['2026-08-09', '2026-08-11', '2026-08-16']);
  });

  it('does not regenerate occurrences from a cancelled or deleted future scope', () => {
    const occurrences = generateRecurrenceOccurrences({ ...series, disabledFrom: '2026-08-09' }, '2026-08-01', '2026-09-30');
    expect(occurrences.map((item) => item.localDate)).toEqual(['2026-08-02', '2026-08-04']);
  });
});

describe('planRecurrenceEdit', () => {
  it('plans a one-occurrence exception', () => {
    expect(planRecurrenceEdit(series, '2026-08-09', 'only')).toEqual({
      type: 'singleException',
      seriesId: 'series-1',
      localDate: '2026-08-09',
    });
  });

  it('splits a series for this-and-future edits', () => {
    const plan = planRecurrenceEdit(series, '2026-08-09', 'future');
    expect(plan.type).toBe('splitSeries');
    if (plan.type === 'splitSeries') {
      expect(plan.previousRule.endsOn).toBe('2026-08-08');
      expect(plan.nextRule.startsOn).toBe('2026-08-09');
    }
  });

  it('updates the parent for entire-series edits', () => {
    expect(planRecurrenceEdit(series, '2026-08-09', 'entire')).toEqual({
      type: 'entireSeries',
      seriesId: 'series-1',
    });
  });
});
