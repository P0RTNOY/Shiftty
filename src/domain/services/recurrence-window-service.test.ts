import { addDays, format } from 'date-fns';
import { checkRollingWindow, MIN_HORIZON_DAYS, TARGET_HORIZON_DAYS } from '@/domain/services/recurrence-window-service';
import type { RecurrenceSeries } from '@/domain/entities';

const NOW = new Date('2026-08-04T12:00:00Z');
const NOW_DATE_STR = '2026-08-04';

const BASE_SERIES: RecurrenceSeries = {
  id: 'series-1',
  rule: {
    id: 'rule-1',
    frequency: 'weekly',
    weekdays: [1],
    startsOn: NOW_DATE_STR,
    timezone: 'UTC',
  },
  template: {
    workplaceId: 'wp-1',
    startTime: '09:00',
    endTime: '17:00',
    expectedBreakMinutes: 30,
    hourlyRateSnapshotMinor: 1000,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('checkRollingWindow', () => {
  it('returns needsExtension=false if latest existing date is beyond MIN_HORIZON_DAYS', () => {
    const farFuture = format(addDays(NOW, MIN_HORIZON_DAYS + 10), 'yyyy-MM-dd');
    const result = checkRollingWindow({
      series: BASE_SERIES,
      existingLocalDates: [NOW_DATE_STR, farFuture],
      exceptionLocalDates: [],
      now: NOW,
    });
    expect(result.needsExtension).toBe(false);
    expect(result.occurrencesToCreate).toHaveLength(0);
    expect(result.newHorizonDate).toBe(farFuture);
  });

  it('returns needsExtension=true and creates occurrences up to TARGET_HORIZON_DAYS if below min horizon', () => {
    const nearFuture = format(addDays(NOW, MIN_HORIZON_DAYS - 10), 'yyyy-MM-dd');
    const result = checkRollingWindow({
      series: BASE_SERIES,
      existingLocalDates: [NOW_DATE_STR, nearFuture],
      exceptionLocalDates: [],
      now: NOW,
    });
    expect(result.needsExtension).toBe(true);
    expect(result.occurrencesToCreate.length).toBeGreaterThan(0);
    
    // The last occurrence should be close to TARGET_HORIZON_DAYS, but not exceed it significantly
    // (since it generates up to windowEnd = TARGET_HORIZON_DAYS)
    const targetHorizonStr = format(addDays(NOW, TARGET_HORIZON_DAYS), 'yyyy-MM-dd');
    const lastGenerated = result.occurrencesToCreate[result.occurrencesToCreate.length - 1];
    expect(lastGenerated!.localDate <= targetHorizonStr).toBe(true);
  });

  it('handles empty existingLocalDates by generating from now', () => {
    const result = checkRollingWindow({
      series: BASE_SERIES,
      existingLocalDates: [],
      exceptionLocalDates: [],
      now: NOW,
    });
    expect(result.needsExtension).toBe(true);
    expect(result.occurrencesToCreate.length).toBeGreaterThan(0);
    expect(result.occurrencesToCreate[0]?.localDate).toBe(NOW_DATE_STR);
  });

  it('skips existing dates and exceptions', () => {
    const existingDate = format(addDays(NOW, 7), 'yyyy-MM-dd');
    const exceptionDate = format(addDays(NOW, 14), 'yyyy-MM-dd');
    
    const result = checkRollingWindow({
      series: BASE_SERIES,
      existingLocalDates: [existingDate],
      exceptionLocalDates: [exceptionDate],
      now: NOW,
    });
    
    expect(result.needsExtension).toBe(true);
    const generatedDates = result.occurrencesToCreate.map(o => o.localDate);
    expect(generatedDates).not.toContain(existingDate);
    expect(generatedDates).not.toContain(exceptionDate);
  });
});
