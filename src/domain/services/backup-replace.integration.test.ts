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

    const result = await orchestrator.restoreReplace(badContent);
    expect(result.success).toBe(false);

    // Original data should remain untouched
    const workplaces = await db.getAllAsync('SELECT * FROM workplaces');
    expect(workplaces.length).toBe(1);
    expect((workplaces[0] as any).id).toBe('wp-safe');
  });

  it('rolls back when a write fails after replacement has started', async () => {
    const timestamp = '2026-08-01T00:00:00Z';
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp-safe', 'Safe WP', timestamp, timestamp]);
    const backupContent = JSON.stringify({
      format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: '2026-08-04T00:00:00Z', timezone: 'UTC', locale: 'en-US',
      counts: { workplaces: 1, roles: 0, shifts: 0, shiftTemplates: 0, salaryProfiles: 0, payRules: 0, breakSessions: 0, recurrenceSeries: 0, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [{ id: 'wp-imported', name: 'Imported', defaultBreakMinutes: 0, defaultHourlyRateMinor: 5000, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false, createdAt: timestamp, updatedAt: timestamp }],
        roles: [], shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: [],
      },
    });
    const originalRun = db.runAsync.bind(db);
    jest.spyOn(db, 'runAsync').mockImplementation(async (sql: string, ...args: SQLite.SQLiteBindValue[]) => {
      if (sql.startsWith('INSERT INTO workplaces')) throw new Error('injected write failure');
      return originalRun(sql, ...args);
    });

    await expect(orchestrator.restoreReplace(backupContent)).resolves.toMatchObject({ success: false });
    expect(await db.getAllAsync<{ id: string }>('SELECT id FROM workplaces ORDER BY id')).toEqual([{ id: 'wp-safe' }]);
  });

  it('rejects a backup whose declared counts do not match its data before restore', async () => {
    const timestamp = '2026-08-01T00:00:00Z';
    const content = JSON.stringify({
      format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: timestamp, timezone: 'UTC', locale: 'en-US',
      counts: { workplaces: 2, roles: 0, shifts: 0, shiftTemplates: 0, salaryProfiles: 0, payRules: 0, breakSessions: 0, recurrenceSeries: 0, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [{ id: 'wp-imported', name: 'Imported', defaultBreakMinutes: 0, defaultHourlyRateMinor: 5000, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false, createdAt: timestamp, updatedAt: timestamp }],
        roles: [], shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: [],
      },
    });

    await expect(orchestrator.validateBackup(content)).resolves.toMatchObject({ valid: false });
  });

  it('reports the actual unsupported backup version in diagnostics', async () => {
    await expect(orchestrator.validateBackup(JSON.stringify({ format: 'shiftty_backup', backupVersion: 2 }))).resolves.toEqual({
      valid: false,
      errors: ['Unsupported backup version: 2'],
    });
  });

  it('rejects recurrence templates whose embedded references are missing', async () => {
    const timestamp = '2026-08-01T00:00:00Z';
    const content = JSON.stringify({
      format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: timestamp, timezone: 'UTC', locale: 'en-US',
      counts: { workplaces: 0, roles: 0, shifts: 0, shiftTemplates: 0, salaryProfiles: 0, payRules: 0, breakSessions: 0, recurrenceSeries: 1, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [], roles: [], shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [], breakSessions: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: [],
        recurrenceSeries: [{
          id: 'series-invalid',
          rule: { id: 'rule-invalid', frequency: 'weekly', weekdays: [1], startsOn: '2026-08-03', timezone: 'Asia/Jerusalem' },
          template: { workplaceId: 'missing-workplace', roleId: 'missing-role', shiftTemplateId: 'missing-template', startTime: '08:00', endTime: '16:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 5000 },
          createdAt: timestamp, updatedAt: timestamp,
        }],
      },
    });

    await expect(orchestrator.validateBackup(content)).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Recurrence series series-invalid references missing workplace missing-workplace',
        'Recurrence series series-invalid references missing role missing-role',
        'Recurrence series series-invalid references missing template missing-template',
      ]),
    });
  });
});
