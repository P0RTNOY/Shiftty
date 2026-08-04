import type { SQLiteDatabase } from 'expo-sqlite';

import { SqliteRecurrenceRepository } from '@/data/repositories/sqlite-recurrence-repository';
import type { RecurrenceSeries } from '@/domain/entities';
import { createShift } from '@/test/fixtures';

const series: RecurrenceSeries = {
  id: 'series-1',
  rule: { id: 'rule-1', frequency: 'weekly', weekdays: [0], startsOn: '2026-08-02', timezone: 'Asia/Jerusalem' },
  template: { workplaceId: 'workplace-1', startTime: '08:00', endTime: '16:00', expectedBreakMinutes: 30, hourlyRateSnapshotMinor: 0 },
  createdAt: '2026-08-01T10:00:00+03:00',
  updatedAt: '2026-08-01T10:00:00+03:00',
};

function databaseMock() {
  return {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  };
}

describe('SqliteRecurrenceRepository', () => {
  it('persists and maps recurrence series', async () => {
    const database = databaseMock();
    const repository = new SqliteRecurrenceRepository(database as unknown as SQLiteDatabase);
    await repository.saveSeries(series);

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recurrence_series'),
      expect.anything(),
      expect.stringContaining('"frequency":"weekly"'),
      expect.stringContaining('"startTime":"08:00"'),
      null,
      expect.anything(),
      expect.anything(),
    );
  });

  it('materializes occurrences transactionally', async () => {
    const database = databaseMock();
    const repository = new SqliteRecurrenceRepository(database as unknown as SQLiteDatabase);
    await repository.materializeOccurrences(series, [
      createShift({ recurrenceGroupId: 'series-1', recurrenceOriginalStart: '2026-08-02T08:00:00+03:00' }),
    ]);

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO shifts'),
      expect.anything(),
    );
  });

  it('applies scoped recurrence changes in one transaction and propagates failures', async () => {
    const database = databaseMock();
    database.runAsync.mockRejectedValueOnce(new Error('write failed'));
    const repository = new SqliteRecurrenceRepository(database as unknown as SQLiteDatabase);
    await expect(repository.applyMutation({ seriesToSave: [series] })).rejects.toThrow('write failed');
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });
});
