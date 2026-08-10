import type { SQLiteDatabase } from 'expo-sqlite';

import { initializeDatabase } from '@/data/database/database';
import { SqliteActiveShiftRepository } from '@/data/repositories/sqlite-active-shift-repository';
import { SqliteShiftRepository } from '@/data/repositories/sqlite-shift-repository';
import { createBreak, createShift } from '@/test/fixtures';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('active break restoration', () => {
  let database: SQLiteDatabase;

  beforeEach(async () => {
    database = createRealSqliteDb();
    await initializeDatabase(database);
    await database.runAsync(
      "INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES ('workplace-1', 'Test Workplace', 6000, '2026-08-10T00:00:00Z', '2026-08-10T00:00:00Z')",
    );
  });

  afterEach(async () => {
    await database.closeAsync();
  });

  it('rehydrates the same active shift and open break from SQLite after a repository restart', async () => {
    const shifts = new SqliteShiftRepository(database);
    const beforeRestart = new SqliteActiveShiftRepository(database);
    await shifts.save(createShift({
      scheduledStart: '2026-08-10T08:00:00+03:00',
      scheduledEnd: '2026-08-10T16:00:00+03:00',
      expectedBreakMinutes: 0,
    }));
    await beforeRestart.startScheduledShift('shift-1', '2026-08-10T08:05:00+03:00');
    await beforeRestart.startBreak(createBreak({
      end: undefined,
      start: '2026-08-10T12:00:00+03:00',
      updatedAt: '2026-08-10T12:00:00+03:00',
    }));

    const afterRestart = new SqliteActiveShiftRepository(database);
    await expect(afterRestart.getActiveShift()).resolves.toMatchObject({ id: 'shift-1', status: 'active' });
    await expect(afterRestart.getActiveBreak('shift-1')).resolves.toMatchObject({ id: 'break-1', end: undefined });
    await expect(afterRestart.listBreaks('shift-1')).resolves.toEqual([
      expect.objectContaining({ id: 'break-1', end: undefined }),
    ]);
    await expect(database.getAllAsync('PRAGMA foreign_key_check;')).resolves.toHaveLength(0);
    await expect(database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check;')).resolves.toEqual({ integrity_check: 'ok' });
  });
});
