import { describe, expect, it } from '@jest/globals';
import { initializeDatabase } from '@/data/database/database';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';
import { SqliteShiftRepository } from '@/data/repositories/sqlite-shift-repository';
import { SqliteActiveShiftRepository } from '@/data/repositories/sqlite-active-shift-repository';
import { Shift } from '@/domain/entities';

describe('Shift Deletion Integration', () => {
  it('should successfully delete a scheduled shift', async () => {
    const db = createRealSqliteDb();
    await initializeDatabase(db);
    await db.runAsync(`INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES ('wp-1', 'Test Workplace', 5000, '', '')`);
    const repo = new SqliteShiftRepository(db);

    await repo.save({
      id: 'test-del-1',
      workplaceId: 'wp-1',
      status: 'scheduled',
      scheduledStart: '2026-08-01T08:00:00.000Z',
      scheduledEnd: '2026-08-01T16:00:00.000Z',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 5000,
      timezone: 'Asia/Jerusalem',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Shift);

    const shift = await repo.getById('test-del-1');
    expect(shift).toBeDefined();

    await repo.deleteMany(['test-del-1']);

    const deletedShift = await repo.getById('test-del-1');
    expect(deletedShift).toBeNull();
  });

  it('should successfully delete a completed shift with breaks and cross-midnight', async () => {
    const db = createRealSqliteDb();
    await initializeDatabase(db);
    await db.runAsync(`INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES ('wp-1', 'Test Workplace', 5000, '', '')`);
    const repo = new SqliteShiftRepository(db);

    await repo.save({
      id: 'test-del-2',
      workplaceId: 'wp-1',
      status: 'completed',
      actualStart: '2026-08-01T22:00:00.000Z',
      actualEnd: '2026-08-02T06:00:00.000Z',
      payableStart: '2026-08-01T22:00:00.000Z',
      payableEnd: '2026-08-02T06:00:00.000Z',
      payableSource: 'actual',
      completedAt: new Date().toISOString(),
      actualBreakMinutes: 30,
      expectedBreakMinutes: 30,
      payableBreakMinutes: 30,
      hourlyRateSnapshotMinor: 5000,
      timezone: 'Asia/Jerusalem',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Shift);

    await repo.deleteMany(['test-del-2']);
    expect(await repo.getById('test-del-2')).toBeNull();
  });

  it('should cancel an active shift properly', async () => {
    const db = createRealSqliteDb();
    await initializeDatabase(db);
    await db.runAsync(`INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES ('wp-1', 'Test Workplace', 5000, '', '')`);
    const activeRepo = new SqliteActiveShiftRepository(db);
    const shiftRepo = new SqliteShiftRepository(db);

    await shiftRepo.save({
      id: 'test-del-3',
      workplaceId: 'wp-1',
      status: 'scheduled',
      scheduledStart: '2026-08-01T08:00:00.000Z',
      scheduledEnd: '2026-08-01T16:00:00.000Z',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 5000,
      timezone: 'Asia/Jerusalem',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Shift);

    const activeShift = await activeRepo.startScheduledShift('test-del-3', new Date().toISOString());
    expect(activeShift).toBeDefined();
    
    // Instead of deleting, active shifts must be cancelled.
    activeShift.status = 'cancelled';
    activeShift.cancelledAt = new Date().toISOString();
    activeShift.actualStart = undefined;
    await shiftRepo.save(activeShift);
    
    expect(await activeRepo.getActiveShift()).toBeNull();
  });
});
