import { createRealSqliteDb } from '@/test-utils/real-sqlite';
import * as SQLite from 'expo-sqlite';
import { BackupOrchestrator } from './backup-orchestrator';
import { DATABASE_MIGRATIONS } from '@/data/database/migrations';

describe('Backup Semantic Round-trip Integration', () => {
  let db: SQLite.SQLiteDatabase;
  let orchestrator: BackupOrchestrator;

  beforeEach(async () => {
    db = createRealSqliteDb();
    
    // Create migrations table first
    await db.execAsync(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);`);
    for (const m of DATABASE_MIGRATIONS) {
      if (Array.isArray(m.sql)) {
         for (const sql of m.sql) { await db.execAsync(sql); }
      } else {
         await db.execAsync(m.sql);
      }
      await db.execAsync(`INSERT OR REPLACE INTO schema_migrations (version) VALUES (${m.version})`);
    }
    
    orchestrator = new BackupOrchestrator(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('preserves optional fields correctly after a round trip (stripNulls behavior)', async () => {
    // 1. Seed data with explicit NULLs for all optional/nullable fields across tables
    
    await db.execAsync(`INSERT INTO workplaces (id, name, address, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp1', 'My Workplace', NULL, 5000, 30, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    await db.execAsync(`INSERT INTO roles (id, workplace_id, name, created_at, updated_at) VALUES ('r1', 'wp1', 'Role', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    await db.execAsync(`INSERT INTO salary_profiles (id, workplace_id, name, standard_hourly_rate_minor, break_policy, created_at, updated_at) VALUES ('sp1', 'wp1', 'Profile 1', 5000, 'unpaid', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    // Shifts
    await db.execAsync(`
      INSERT INTO shifts (
        id, workplace_id, role_id, salary_profile_id, title, notes,
        scheduled_start, scheduled_end, actual_start, actual_end, 
        expected_break_minutes, status, hourly_rate_snapshot_minor,
        shift_template_id, cancelled_at, completed_at, timezone,
        active_origin,
        created_at, updated_at
      ) VALUES (
        'sh1', 'wp1', 'r1', NULL, 'Shift 1', NULL,
        NULL, NULL, '2026-08-01T09:00:00Z', NULL,
        30, 'active', 5000,
        NULL, NULL, NULL, 'Asia/Jerusalem',
        'unscheduled',
        '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'
      )
    `);

    // Break sessions (end_time is nullable)
    await db.execAsync(`INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, created_at, updated_at) VALUES ('b1', 'sh1', '2026-08-01T12:00:00Z', NULL, 0, 'manual', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    // Recurrence Series (disabled_from is nullable)
    await db.execAsync(`INSERT INTO recurrence_series (id, template_json, rule_json, disabled_from, created_at, updated_at) VALUES ('rs1', '{"workplaceId":"wp1","roleId":"r1","startTime":"09:00","endTime":"17:00","expectedBreakMinutes":30,"hourlyRateSnapshotMinor":5000}', '{"id":"rl1","frequency":"weekly","weekdays":[1],"startsOn":"2026-08-01","timezone":"Asia/Jerusalem"}', NULL, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    // Scheduled Notifications (shift_id, break_session_id are nullable, native_id is nullable)
    await db.execAsync(`INSERT INTO scheduled_notification_records (logical_key, type, scheduled_for, shift_id, break_session_id, workplace_id, title_key, body_key, body_params_json, native_id, created_at, updated_at) VALUES ('ntf1', 'missed_clock_in', '2026-08-01T10:00:00Z', NULL, NULL, NULL, 'title', 'body', NULL, NULL, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')`);

    // 2. Export Backup A
    const backupA = await orchestrator.generateBackup();

    // 3. Replace Restore Backup A into a Clean DB
    await orchestrator.clearAllData();

    const restoreResult = await orchestrator.restoreReplace(JSON.stringify(backupA));
    expect(restoreResult.success).toBe(true);

    // 4. Export Backup B
    const backupB = await orchestrator.generateBackup();

    // 5. Compare Normalized Semantic Data
    expect(backupB.data).toEqual(backupA.data);

    // Verify specifically that omitted/null fields remained undefined
    expect(backupB.data.workplaces[0].address).toBeUndefined();
    expect(backupB.data.salaryProfiles[0].effectiveTo).toBeUndefined();
    expect(backupB.data.shifts[0].notes).toBeUndefined();
    expect(backupB.data.shifts[0].actualEnd).toBeUndefined();
    expect(backupB.data.breakSessions[0].end).toBeUndefined();
    expect(backupB.data.recurrenceSeries[0].endDate).toBeUndefined();
    expect(backupB.data.scheduledNotifications[0].shiftId).toBeUndefined();
  });
});
