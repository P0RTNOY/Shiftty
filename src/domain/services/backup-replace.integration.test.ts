import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { BackupOrchestrator } from './backup-orchestrator';

import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('Backup Replace Integration', () => {
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

  it('replaces all data transactionally', async () => {
    // 1. Insert existing local data
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp-local', 'Local WP', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);
    
    // 2. Generate a valid backup envelope with DIFFERENT data
    const backupContent = JSON.stringify({
      format: 'shiftty_backup',
      backupVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-08-04T00:00:00Z',
      timezone: 'UTC',
      locale: 'en-US',
      counts: { workplaces: 1, roles: 0, shifts: 0, shiftTemplates: 0, salaryProfiles: 0, payRules: 0, breakSessions: 0, recurrenceSeries: 0, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [
          { id: 'wp-cloud', name: 'Cloud WP', createdAt: '2026-08-02T00:00:00Z', updatedAt: '2026-08-02T00:00:00Z', defaultBreakMinutes: 0, defaultHourlyRateMinor: 0, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false }
        ],
        roles: [], shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: []
      }
    });

    // 3. Restore with replace strategy
    const result = await orchestrator.restoreReplace(backupContent);
    expect(result.success).toBe(true);

    // 4. Verify existing data was wiped and imported data is present
    const workplaces = await db.getAllAsync('SELECT * FROM workplaces');
    expect(workplaces.length).toBe(1);
    expect((workplaces[0] as any).id).toBe('wp-cloud');
  });

  it('rolls back on failure without leaving partial data', async () => {
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp-safe', 'Safe WP', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);

    const badContent = JSON.stringify({
      format: 'shiftty_backup',
      backupVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-08-04T00:00:00Z',
      timezone: 'UTC',
      locale: 'en-US',
      counts: { workplaces: 1, shifts: 1 }, // Lying about counts to trigger error
      data: {
        workplaces: [{ id: 'wp-imported', name: 'Imported WP', createdAt: '2026-08-04T00:00:00Z', updatedAt: '2026-08-04T00:00:00Z', defaultBreakMinutes: 0, defaultHourlyRateMinor: 0, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false }],
        shifts: [], roles: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: []
      }
    });

    try {
      await orchestrator.restoreReplace(badContent);
    } catch (e) {}

    // Original data should remain untouched
    const workplaces = await db.getAllAsync('SELECT * FROM workplaces');
    expect(workplaces.length).toBe(1);
    expect((workplaces[0] as any).id).toBe('wp-safe');
  });
});
