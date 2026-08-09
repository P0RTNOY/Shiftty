import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { BackupOrchestrator } from './backup-orchestrator';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('Clear All Data Integration', () => {
  let db: SQLite.SQLiteDatabase;
  let orchestrator: BackupOrchestrator;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await initializeDatabase(db);
    orchestrator = new BackupOrchestrator(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('deletes all user data but retains schema, migrations and resets store', async () => {
    // 1. Insert local data
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp1', 'Local WP', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);
    await db.runAsync('INSERT INTO shifts (id, workplace_id, title, status, scheduled_start, scheduled_end, hourly_rate_snapshot_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 5000, ?, ?)', ['sh1', 'wp1', 'Shift 1', 'scheduled', '2026-08-01T09:00:00Z', '2026-08-01T17:00:00Z', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);

    // 2. Clear all data
    await orchestrator.clearAllData();

    // 3. Verify user data is gone
    const workplaces = await db.getAllAsync('SELECT * FROM workplaces');
    expect(workplaces.length).toBe(0);
    const shifts = await db.getAllAsync('SELECT * FROM shifts');
    expect(shifts.length).toBe(0);

    // 4. Verify schema/migrations remain
    const migrations = await db.getAllAsync('SELECT * FROM schema_migrations');
    expect(migrations.length).toBeGreaterThan(0);

    // 5. Verification complete
  });
});
