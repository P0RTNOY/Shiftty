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

  it('merges settings, prediction feedback, notification records, and workplace overrides without native IDs', async () => {
    const timestamp = '2026-08-04T00:00:00Z';
    const content = makeBackup({
      workplaces: [workplace('wp-imported', timestamp)],
      predictionFeedback: [{
        id: 'feedback-imported', feedbackType: 'accepted_all', engineVersion: '1.0.0',
        candidateSource: 'template', candidateSourceId: 'template-imported', score: 88,
        acceptedFields: ['workplaceId'], rejectedFields: [], createdAt: timestamp,
      }],
      scheduledNotifications: [{
        logicalKey: 'daily-summary:2026-08-04', type: 'daily_summary', scheduledFor: '2026-08-04T17:00:00Z',
        workplaceId: 'wp-imported', titleKey: 'notification.daily.title', bodyKey: 'notification.daily.body',
        nativeId: 'must-not-survive', createdAt: timestamp, updatedAt: timestamp,
      }],
      appSettings: [{ key: 'notification_preferences_v1', valueJson: '{"masterEnabled":false}', updatedAt: timestamp }],
      workplaceNotificationOverrides: [{
        workplaceId: 'wp-imported', scheduledShiftReminders: false, missedClockInGraceMinutes: 0,
        longBreakReminders: false, updatedAt: timestamp,
      }],
    });

    await expect(orchestrator.restoreMerge(JSON.stringify(content))).resolves.toMatchObject({ success: true });
    expect(await db.getFirstAsync('SELECT key FROM app_settings WHERE key = ?', ['notification_preferences_v1'])).not.toBeNull();
    expect(await db.getFirstAsync('SELECT id FROM prediction_feedback WHERE id = ?', ['feedback-imported'])).not.toBeNull();
    expect(await db.getFirstAsync<{ native_id: string | null }>('SELECT native_id FROM scheduled_notification_records WHERE logical_key = ?', ['daily-summary:2026-08-04'])).toEqual({ native_id: null });
    expect(await db.getFirstAsync('SELECT workplace_id FROM workplace_notification_overrides WHERE workplace_id = ?', ['wp-imported'])).not.toBeNull();
  });

  it('preserves an imported active shift only when it does not conflict with local tracking', async () => {
    const timestamp = '2026-08-04T00:00:00Z';
    const importedActive = activeShift('active-imported', 'wp-imported', timestamp);
    const content = makeBackup({ workplaces: [workplace('wp-imported', timestamp)], shifts: [importedActive] });

    await expect(orchestrator.restoreMerge(JSON.stringify(content))).resolves.toMatchObject({ success: true });
    expect(await db.getFirstAsync<{ status: string }>('SELECT status FROM shifts WHERE id = ?', ['active-imported'])).toEqual({ status: 'active' });
  });

  it('rejects conflicting local and imported active shifts without mutating local data', async () => {
    const timestamp = '2026-08-04T00:00:00Z';
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp-local', 'Local', timestamp, timestamp]);
    await db.runAsync("INSERT INTO shifts (id, workplace_id, actual_start, expected_break_minutes, status, hourly_rate_snapshot_minor, active_origin, timezone, created_at, updated_at) VALUES ('active-local', 'wp-local', ?, 0, 'active', 5000, 'unscheduled', 'Asia/Jerusalem', ?, ?)", [timestamp, timestamp, timestamp]);
    const content = makeBackup({
      workplaces: [workplace('wp-imported', timestamp)],
      shifts: [activeShift('active-imported', 'wp-imported', timestamp)],
    });

    await expect(orchestrator.restoreMerge(JSON.stringify(content))).resolves.toMatchObject({ success: false });
    expect(await db.getFirstAsync<{ status: string }>('SELECT status FROM shifts WHERE id = ?', ['active-local'])).toEqual({ status: 'active' });
    expect(await db.getFirstAsync('SELECT id FROM shifts WHERE id = ?', ['active-imported'])).toBeNull();
    expect(await db.getFirstAsync('SELECT id FROM workplaces WHERE id = ?', ['wp-imported'])).toBeNull();
  });

  it('maps dependent records to an existing semantic recurrence occurrence', async () => {
    const timestamp = '2026-08-04T00:00:00Z';
    const scheduledStart = '2026-08-10T05:00:00Z';
    const scheduledEnd = '2026-08-10T13:00:00Z';
    await db.runAsync('INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)', ['wp1', 'Work', timestamp, timestamp]);
    await db.runAsync('INSERT INTO recurrence_series (id, rule_json, template_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
      'series1', JSON.stringify(recurrenceSeries(timestamp).rule), JSON.stringify(recurrenceSeries(timestamp).template), timestamp, timestamp,
    ]);
    await db.runAsync("INSERT INTO shifts (id, workplace_id, scheduled_start, scheduled_end, expected_break_minutes, status, hourly_rate_snapshot_minor, recurrence_group_id, recurrence_original_start, timezone, created_at, updated_at) VALUES ('local-occurrence', 'wp1', ?, ?, 0, 'scheduled', 5000, 'series1', ?, 'Asia/Jerusalem', ?, ?)", [scheduledStart, scheduledEnd, scheduledStart, timestamp, timestamp]);

    const backupOccurrence = scheduledShift('backup-occurrence', 'wp1', scheduledStart, scheduledEnd, timestamp);
    const content = makeBackup({
      workplaces: [workplace('wp1', timestamp, 'Work')],
      shifts: [backupOccurrence],
      recurrenceSeries: [recurrenceSeries(timestamp)],
      recurrenceExceptions: [{ id: 'exception-imported', seriesId: 'series1', localDate: '2026-08-10', type: 'modified', shiftId: 'backup-occurrence', createdAt: timestamp }],
      breakSessions: [{ id: 'break-imported', shiftId: 'backup-occurrence', start: '2026-08-10T09:00:00Z', end: '2026-08-10T09:15:00Z', isPaid: false, source: 'manual', createdAt: timestamp, updatedAt: timestamp }],
      salarySnapshots: [{
        id: 'snapshot-imported', shiftId: 'backup-occurrence', version: 1, status: 'estimated', isCurrent: true, createdAt: timestamp,
        result: {
          context: 'scheduled', calculationTimezone: 'Asia/Jerusalem', sourceRange: { start: scheduledStart, end: scheduledEnd },
          workIntervals: [], grossMinutes: 0, paidBreakMinutes: 0, unpaidBreakMinutes: 0, payableMinutes: 0,
          regularMinutes: 0, specialRateMinutes: 0, segments: [], basePayMinor: 0, premiumPayMinor: 0,
          minimumDurationAdjustmentMinutes: 0, minimumDurationAdjustmentMinor: 0, fixedBonusesMinor: 0,
          reimbursementsMinor: 0, totalGrossPayMinor: 0, appliedRuleIds: [], issues: [], explanations: [],
          calculatedAt: timestamp, engineVersion: '1.0.0',
        },
      }],
    });

    await expect(orchestrator.restoreMerge(JSON.stringify(content))).resolves.toMatchObject({ success: true });
    expect(await db.getFirstAsync<{ shift_id: string }>('SELECT shift_id FROM recurrence_exceptions WHERE id = ?', ['exception-imported'])).toEqual({ shift_id: 'local-occurrence' });
    expect(await db.getFirstAsync<{ shift_id: string }>('SELECT shift_id FROM break_sessions WHERE id = ?', ['break-imported'])).toEqual({ shift_id: 'local-occurrence' });
    expect(await db.getFirstAsync<{ shift_id: string }>('SELECT shift_id FROM salary_calculation_snapshots WHERE id = ?', ['snapshot-imported'])).toEqual({ shift_id: 'local-occurrence' });
  });

  it('remaps recurrence template references when an imported workplace ID collides', async () => {
    const localTimestamp = '2026-08-01T00:00:00Z';
    const importedTimestamp = '2026-08-04T00:00:00Z';
    await db.runAsync(
      'INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 5000, ?, ?)',
      ['wp1', 'Local workplace', localTimestamp, localTimestamp],
    );
    const content = makeBackup({
      workplaces: [workplace('wp1', importedTimestamp, 'Imported workplace')],
      recurrenceSeries: [recurrenceSeries(importedTimestamp)],
    });

    await expect(orchestrator.restoreMerge(JSON.stringify(content))).resolves.toMatchObject({ success: true });

    const importedWorkplace = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workplaces WHERE name = ?',
      ['Imported workplace'],
    );
    const importedSeries = await db.getFirstAsync<{ template_json: string }>(
      'SELECT template_json FROM recurrence_series WHERE id = ?',
      ['series1'],
    );
    expect(importedWorkplace?.id).toBeDefined();
    expect(importedWorkplace?.id).not.toBe('wp1');
    expect(JSON.parse(importedSeries!.template_json)).toMatchObject({ workplaceId: importedWorkplace?.id });
  });
});

function makeBackup(overrides: Record<string, unknown>) {
  const data = {
    workplaces: [], roles: [], shifts: [], shiftTemplates: [], salaryProfiles: [], payRules: [],
    breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [],
    predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: [],
    workplaceNotificationOverrides: [],
    ...overrides,
  } as Record<string, any[]>;
  return {
    format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: '2026-08-04T00:00:00Z',
    timezone: 'UTC', locale: 'en-US',
    counts: Object.fromEntries(Object.entries(data).map(([key, values]) => [key, values.length])),
    data,
  };
}

function workplace(id: string, timestamp: string, name = 'Imported') {
  return { id, name, defaultBreakMinutes: 0, defaultHourlyRateMinor: 5000, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false, createdAt: timestamp, updatedAt: timestamp };
}

function activeShift(id: string, workplaceId: string, timestamp: string) {
  return { id, workplaceId, actualStart: timestamp, expectedBreakMinutes: 0, status: 'active', hourlyRateSnapshotMinor: 5000, activeOrigin: 'unscheduled', salaryCalculationStatus: 'not_calculated', timezone: 'Asia/Jerusalem', createdAt: timestamp, updatedAt: timestamp };
}

function recurrenceSeries(timestamp: string) {
  return {
    id: 'series1',
    rule: { id: 'rule1', frequency: 'weekly', weekdays: [1], startsOn: '2026-08-10', timezone: 'Asia/Jerusalem' },
    template: { workplaceId: 'wp1', startTime: '08:00', endTime: '16:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 5000 },
    createdAt: timestamp, updatedAt: timestamp,
  };
}

function scheduledShift(id: string, workplaceId: string, scheduledStart: string, scheduledEnd: string, timestamp: string) {
  return { id, workplaceId, scheduledStart, scheduledEnd, expectedBreakMinutes: 0, status: 'scheduled', hourlyRateSnapshotMinor: 5000, recurrenceGroupId: 'series1', recurrenceOriginalStart: scheduledStart, salaryCalculationStatus: 'not_calculated', timezone: 'Asia/Jerusalem', createdAt: timestamp, updatedAt: timestamp };
}
