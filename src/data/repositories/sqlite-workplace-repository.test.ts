import type { SQLiteDatabase } from 'expo-sqlite';

import { SqliteWorkplaceRepository } from '@/data/repositories/sqlite-workplace-repository';

describe('SqliteWorkplaceRepository', () => {
  it('creates and lists validated workplaces', async () => {
    const database = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 'work-1', name: 'בית קפה', address: null, default_hourly_rate_minor: 0,
          default_break_minutes: 30, salary_profile_id: null, color: null,
          created_at: '2026-08-01T10:00:00+03:00', updated_at: '2026-08-01T10:00:00+03:00',
        },
      ]),
    };
    const repository = new SqliteWorkplaceRepository(database as unknown as SQLiteDatabase);

    await expect(repository.list()).resolves.toHaveLength(1);
    await repository.save({
      id: 'work-1', name: 'בית קפה', defaultHourlyRateMinor: 0, defaultBreakMinutes: 30,
      createdAt: '2026-08-01T10:00:00+03:00', updatedAt: '2026-08-01T10:00:00+03:00',
    });
    expect(database.runAsync).toHaveBeenCalledTimes(1);
  });
});
