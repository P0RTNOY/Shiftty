import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { calculateSalary } from '@/domain/services';
import { createSalaryProfile, createShift } from '@/test/fixtures';
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

  it('restores a legacy V1 salary profile with neutral weekly defaults', async () => {
    const timestamp = '2026-08-04T00:00:00Z';
    const content = JSON.stringify({
      format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: timestamp, timezone: 'UTC', locale: 'en-US',
      counts: { workplaces: 1, roles: 0, shifts: 0, shiftTemplates: 0, salaryProfiles: 1, payRules: 0, breakSessions: 0, recurrenceSeries: 0, recurrenceExceptions: 0, salarySnapshots: 0, predictionFeedback: 0, scheduledNotifications: 0, exportPresets: 0, exportHistory: 0, appSettings: 0 },
      data: {
        workplaces: [{ id: 'wp-legacy', name: 'Legacy', salaryProfileId: 'profile-legacy', defaultBreakMinutes: 0, defaultHourlyRateMinor: 6000, defaultShiftBonusMinor: 0, defaultTravelReimbursementMinor: 0, isArchived: false, createdAt: timestamp, updatedAt: timestamp }],
        salaryProfiles: [{ id: 'profile-legacy', workplaceId: 'wp-legacy', name: 'Legacy profile', currency: 'ILS', timezone: 'Asia/Jerusalem', baseHourlyRateMinor: 6000, defaultTravelReimbursementMinor: 0, defaultShiftBonusMinor: 0, calculationRoundingMode: 'half_up', breakPolicy: 'perBreak', isActive: true, isArchived: false, createdAt: timestamp, updatedAt: timestamp }],
        roles: [], shifts: [], shiftTemplates: [], payRules: [], breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [], predictionFeedback: [], scheduledNotifications: [], exportPresets: [], exportHistory: [], appSettings: [],
      },
    });

    await expect(orchestrator.restoreReplace(content)).resolves.toMatchObject({ success: true });
    expect(await db.getFirstAsync("SELECT workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes, weekly_overtime_multiplier_basis_points, weekly_overtime_basis FROM salary_profiles WHERE id='profile-legacy'"))
      .toEqual({ workweek_start_weekday: 0, weekly_overtime_enabled: 0, weekly_regular_minutes: null, weekly_overtime_multiplier_basis_points: null, weekly_overtime_basis: 'net' });
  });

  it('preserves finalized shift statuses regardless of current snapshot payload order', async () => {
    const timestamp = '2026-08-24T00:00:00Z';
    const profile = createSalaryProfile({
      id: 'profile-weekly', workplaceId: 'wp-weekly', baseHourlyRateMinor: 6000,
      weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2520,
      weeklyOvertimeMultiplierBasisPoints: 12500,
    });
    const source = createShift({
      id: 'source', workplaceId: 'wp-weekly', salaryProfileId: profile.id, status: 'completed',
      actualStart: '2026-08-30T08:00:00+03:00', actualEnd: '2026-08-30T09:00:00+03:00',
      payableStart: '2026-08-30T08:00:00+03:00', payableEnd: '2026-08-30T09:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-08-30T09:00:00+03:00',
      salaryCalculationStatus: 'finalized', hourlyRateSnapshotMinor: 6000,
    });
    const later = createShift({
      id: 'later', workplaceId: 'wp-weekly', salaryProfileId: profile.id, status: 'completed',
      actualStart: '2026-09-04T08:00:00+03:00', actualEnd: '2026-09-04T09:00:00+03:00',
      payableStart: '2026-09-04T08:00:00+03:00', payableEnd: '2026-09-04T09:00:00+03:00',
      payableBreakMinutes: 0, payableSource: 'actual', completedAt: '2026-09-04T09:00:00+03:00',
      salaryCalculationStatus: 'finalized', hourlyRateSnapshotMinor: 6000,
    });
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp-weekly', 'Weekly', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES (?, ?, ?, 'ILS', 6000, 'perBreak', 'Asia/Jerusalem', 0, 1, 2520, 12500, 'net', ?, ?)`,
    profile.id, profile.workplaceId!, profile.name, timestamp, timestamp);
    await db.runAsync("UPDATE workplaces SET salary_profile_id=? WHERE id='wp-weekly'", profile.id);
    for (const shift of [source, later]) {
      await db.runAsync(`INSERT INTO shifts (
        id, workplace_id, salary_profile_id, actual_start, actual_end, payable_start, payable_end,
        expected_break_minutes, actual_break_minutes, payable_break_minutes, status,
        hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
        timezone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'completed', 6000, 'actual', ?, 'finalized', 'Asia/Jerusalem', ?, ?)`,
      shift.id, shift.workplaceId, shift.salaryProfileId!, shift.actualStart!, shift.actualEnd!, shift.payableStart!, shift.payableEnd!, shift.completedAt!, timestamp, timestamp);
      const result = calculateSalary({ shift, profile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: timestamp });
      await db.runAsync(`INSERT INTO salary_calculation_snapshots (
        id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor,
        payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor,
        fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json,
        engine_version, calculated_at, is_current, created_at
      ) VALUES (?, ?, 1, 'finalized', 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      `snapshot-${shift.id}`, shift.id, profile.id, result.resolvedBaseHourlyRateMinor!, result.payableMinutes,
      result.regularMinutes, result.specialRateMinutes, result.basePayMinor, result.premiumPayMinor,
      result.fixedBonusesMinor, result.reimbursementsMinor, result.totalGrossPayMinor!, JSON.stringify(result),
      result.engineVersion, result.calculatedAt, timestamp);
    }
    const backup = await orchestrator.generateBackup();
    backup.data.salarySnapshots = [
      backup.data.salarySnapshots.find((item) => item.shiftId === later.id)!,
      backup.data.salarySnapshots.find((item) => item.shiftId === source.id)!,
    ];

    await expect(orchestrator.restoreReplace(JSON.stringify(backup))).resolves.toMatchObject({ success: true });
    expect(await db.getAllAsync("SELECT id, salary_calculation_status FROM shifts ORDER BY id"))
      .toEqual([
        { id: 'later', salary_calculation_status: 'finalized' },
        { id: 'source', salary_calculation_status: 'finalized' },
      ]);
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
