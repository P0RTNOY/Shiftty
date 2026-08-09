import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { BackupOrchestrator } from './backup-orchestrator';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('Backup Export Integration', () => {
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

  it('exports all entities and excludes native notification IDs', async () => {
    // 1. Insert seed data
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp1', 'My Workplace', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);
    await db.runAsync('INSERT INTO shifts (id, workplace_id, title, status, scheduled_start, scheduled_end, hourly_rate_snapshot_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 5000, ?, ?)', ['sh1', 'wp1', 'Shift 1', 'scheduled', '2026-08-01T09:00:00Z', '2026-08-01T17:00:00Z', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);
    
    // Inject a notification ID to prove it doesn't get exported in backup
    await db.runAsync('INSERT INTO scheduled_notification_records (logical_key, type, scheduled_for, shift_id, title_key, body_key, native_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ['notif1', 'shift_reminder', '2026-08-01T10:00:00Z', 'sh1', 'shift_start', 'shift_start', 'NATIVE-12345', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);

    const backup = await orchestrator.generateBackup();
    expect(backup.backupVersion).toBe(1);
    expect(backup.counts!.workplaces).toBe(1);
    expect(backup.counts!.shifts).toBe(1);

    const data = backup.data;
    expect(data.workplaces[0]!.id).toBe('wp1');
    expect(data.shifts[0]!.id).toBe('sh1');
    
    // Ensure notifications aren't exported as per requirements
    // (Wait, are scheduled_notifications backed up? No, the requirements say "Verify it excludes: Native notification IDs")
    expect(backup.data.scheduledNotifications.length).toBe(1);
    expect((backup.data.scheduledNotifications[0] as any).nativeId).toBeUndefined();
  });
});
