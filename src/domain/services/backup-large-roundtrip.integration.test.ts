import { initializeDatabase } from '@/data/database/database';
import { BackupOrchestrator } from '@/domain/services/backup-orchestrator';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

jest.setTimeout(60_000);

it('round-trips a large zero-rate shift dataset with SQLite integrity intact', async () => {
  const source = createRealSqliteDb();
  const target = createRealSqliteDb();
  const timestamp = '2026-08-25T00:00:00.000Z';
  try {
    await initializeDatabase(source);
    await initializeDatabase(target);
    await source.runAsync(
      `INSERT INTO workplaces (
        id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at
      ) VALUES ('bulk-workplace', 'Bulk', 0, 0, ?, ?);`,
      timestamp,
      timestamp,
    );
    const shiftRows = Array.from({ length: 250 }, (_, index) => {
      const id = `bulk-${String(index).padStart(4, '0')}`;
      return `('${id}', 'bulk-workplace', '2026-08-25T00:00:00.000Z',
        '2026-08-25T01:00:00.000Z', 0, 'scheduled', 0, 'not_calculated',
        'Asia/Jerusalem', '${timestamp}', '${timestamp}')`;
    }).join(',');
    await source.execAsync(`INSERT INTO shifts (
      id, workplace_id, scheduled_start, scheduled_end, expected_break_minutes, status,
      hourly_rate_snapshot_minor, salary_calculation_status, timezone, created_at, updated_at
    ) VALUES ${shiftRows};`);

    const exported = await new BackupOrchestrator(source).generateBackup();
    expect(exported.counts.shifts).toBe(250);
    await expect(new BackupOrchestrator(target).restoreReplace(JSON.stringify(exported)))
      .resolves.toMatchObject({ success: true });

    const regenerated = await new BackupOrchestrator(target).generateBackup();
    expect(regenerated.data.shifts).toEqual(exported.data.shifts);
    expect(regenerated.data.shifts[0]).toMatchObject({ hourlyRateSnapshotMinor: 0 });
    await expect(target.getFirstAsync('PRAGMA integrity_check'))
      .resolves.toEqual({ integrity_check: 'ok' });
    await expect(target.getAllAsync('PRAGMA foreign_key_check')).resolves.toEqual([]);
  } finally {
    await source.closeAsync();
    await target.closeAsync();
  }
});
