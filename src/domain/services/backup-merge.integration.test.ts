import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { BackupOrchestrator } from './backup-orchestrator';

import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('Backup Merge Integration', () => {
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

  it('determines identical skipped records, inserts new ones, and remaps conflicting IDs', async () => {
    // Local DB has a workplace "wp1" created yesterday
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp1', 'Local WP', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);
    
    // Local DB has a role "r1"
    await db.runAsync('INSERT INTO roles (id, workplace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', ['r1', 'wp1', 'Local Role', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z']);

    // Backup contains:
    // wp1 - Identical! Should be SKIPPED.
    // r1 - DIFFERENT updatedAt! Should be REMAPPED to new ID.
    // wp2 - NEW! Should preserve ID.
    const backupContent = JSON.stringify({
      format: 'shiftty_backup',
      backupVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-08-04T00:00:00Z',
      timezone: 'UTC',
      locale: 'en-US',
      counts: { workplaces: 2, roles: 1, shifts: 0, shiftTemplates: 0, salaryProfiles: 0, payRules: 0, breakSessions: 0, recurrenceSeries: 0, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [
          { id: 'wp1', name: 'Local WP', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', defaultBreakMinutes: 0, defaultHourlyRateMinor: 0, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false },
          { id: 'wp2', name: 'New WP', createdAt: '2026-08-04T00:00:00Z', updatedAt: '2026-08-04T00:00:00Z', defaultBreakMinutes: 0, defaultHourlyRateMinor: 0, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false }
        ],
        roles: [
          { id: 'r1', workplaceId: 'wp1', name: 'Different Role', hourlyRateMinor: 5000, isArchived: false, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-04T00:00:00Z' }
        ],
        shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: []
      }
    });

    const result = await orchestrator.restoreMerge(backupContent);
    if (!result.success) console.log('MERGE FAILED:', result.message, result.errors);
    expect(result.success).toBe(true);

    const workplaces = await db.getAllAsync('SELECT * FROM workplaces');
    expect(workplaces.length).toBe(2);
    
    const roles = await db.getAllAsync<{id: string, workplace_id: string, name: string}>('SELECT * FROM roles');
    expect(roles.length).toBe(2);
    
    // Find the remapped role (name = Different Role)
    const newRole = roles.find(r => r.name === 'Different Role');
    expect(newRole).toBeDefined();
    expect(newRole!.id).not.toBe('r1'); // It got remapped!
    expect(newRole!.workplace_id).toBe('wp1'); // But it still points to wp1!
  });
});
