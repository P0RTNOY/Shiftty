import type * as SQLite from 'expo-sqlite';

import { initializeDatabase } from '@/data/database/database';
import { parseBackupEnvelope } from '@/domain/entities/backup';
import { BackupOrchestrator } from '@/domain/services/backup-orchestrator';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

const timestamp = '2026-08-24T00:00:00Z';

describe('evidence-aware Backup V1 compatibility', () => {
  it('reads a legacy V1 envelope with neutral evidence defaults', () => {
    const envelope = parseBackupEnvelope(legacyEmptyBackup());
    expect(envelope.backupVersion).toBe(1);
    expect(envelope.data.calendarEvidenceIntervals).toEqual([]);
    expect(envelope.data.weeklyRestSchedules).toEqual([]);
    expect(envelope.counts.calendarEvidenceIntervals).toBe(0);
    expect(envelope.counts.weeklyRestSchedules).toBe(0);
  });

  it('exports and replace-restores active/archived evidence and recurring configuration', async () => {
    const db = createRealSqliteDb();
    await initializeDatabase(db);
    const orchestrator = new BackupOrchestrator(db);
    try {
      await seedProfile(db);
      await db.runAsync(`INSERT INTO calendar_evidence_intervals (
        id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
        source_kind, source_title, source_url, preset_id, preset_version, confirmed_at,
        is_archived, archived_at, created_at, updated_at
      ) VALUES
        ('active-evidence', 'wp', 'profile', 'holiday', 'Holiday', '2026-09-01T00:00:00Z',
         '2026-09-02T00:00:00Z', 'Asia/Jerusalem', 'confirmed_preset', 'Official fixture',
         'https://example.com/source', 'fixture', '1', ?, 0, NULL, ?, ?),
        ('archived-evidence', 'wp', NULL, 'custom', 'Archived', '2026-08-01T00:00:00Z',
         '2026-08-02T00:00:00Z', 'Asia/Jerusalem', 'manual', NULL, NULL, NULL, NULL,
         ?, 1, '2026-08-03T00:00:00Z', ?, ?)`,
      timestamp, timestamp, timestamp, timestamp, timestamp, timestamp);
      await db.runAsync(`INSERT INTO weekly_rest_schedules (
        id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
        end_time, enabled, confirmed_at, source_kind, is_archived, created_at, updated_at
      ) VALUES ('rest', 'wp', 'profile', 'Weekly rest', 5, '18:00', 6, '18:00',
        1, ?, 'manual', 0, ?, ?)`, timestamp, timestamp, timestamp);
      await db.runAsync(`INSERT INTO calendar_evidence_intervals (
        id, schedule_id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at,
        timezone, source_kind, confirmed_at, created_at, updated_at
      ) VALUES ('linked-rest-evidence', 'rest', 'wp', 'profile', 'weekly_rest', 'Linked rest',
        '2026-09-04T15:00:00Z', '2026-09-05T15:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
      timestamp, timestamp, timestamp);
      await db.runAsync(`INSERT INTO pay_rules (
        id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack,
        premium_family, is_enabled, created_at, updated_at
      ) VALUES ('holiday-rule', 'profile', 'Configured holiday pay', 10,
        '[{"type":"specialInterval","intervalTypes":["holiday"]}]',
        '{"type":"multiplier","basisPoints":15000}', 0, 'special_interval', 1, ?, ?)`,
      timestamp, timestamp);

      const first = await orchestrator.generateBackup();
      expect(first.counts).toMatchObject({ calendarEvidenceIntervals: 3, weeklyRestSchedules: 1 });
      expect(first.data.calendarEvidenceIntervals).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'active-evidence', presetId: 'fixture', presetVersion: '1' }),
        expect.objectContaining({ id: 'archived-evidence', isArchived: true }),
        expect.objectContaining({ id: 'linked-rest-evidence', scheduleId: 'rest' }),
      ]));
      expect(first.data.weeklyRestSchedules[0]).toMatchObject({ id: 'rest', enabled: true });
      expect(first.data.payRules).toContainEqual(expect.objectContaining({
        id: 'holiday-rule', premiumFamily: 'special_interval',
        conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      }));

      await expect(orchestrator.restoreReplace(JSON.stringify(first))).resolves.toMatchObject({ success: true });
      const second = await orchestrator.generateBackup();
      expect(second.data.calendarEvidenceIntervals).toEqual(first.data.calendarEvidenceIntervals);
      expect(second.data.weeklyRestSchedules).toEqual(first.data.weeklyRestSchedules);
      expect(second.data.payRules).toEqual(first.data.payRules);
      expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
    } finally {
      await db.closeAsync();
    }
  });

  it('merge-remaps evidence provenance and preserves a current snapshot for a new shift', async () => {
    const source = createRealSqliteDb();
    const target = createRealSqliteDb();
    await initializeDatabase(source);
    await initializeDatabase(target);
    try {
      await seedProfile(source);
      await seedProfile(target);
      await target.runAsync("UPDATE salary_profiles SET name='Local profile collision', updated_at='2026-08-25T00:00:00Z' WHERE id='profile'");
      await insertEvidence(source, 'Imported evidence', '2026-08-24T00:00:00Z');
      // Equal timestamps are not sufficient evidence of semantic identity.
      await insertEvidence(target, 'Local collision', timestamp);
      await insertSpecialRule(source);
      await insertSpecialRule(target);
      await source.runAsync(`INSERT INTO weekly_rest_schedules (
        id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
        end_time, enabled, confirmed_at, source_kind, is_archived, created_at, updated_at
      ) VALUES ('imported-rest', 'wp', 'profile', 'Imported weekly rest', 5, '18:00', 6,
        '18:00', 1, ?, 'manual', 0, ?, ?)`, timestamp, timestamp, timestamp);
      await target.runAsync(`INSERT INTO weekly_rest_schedules (
        id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
        end_time, enabled, confirmed_at, source_kind, is_archived, created_at, updated_at
      ) VALUES ('imported-rest', 'wp', 'profile', 'Local weekly rest collision', 4, '17:00', 5,
        '17:00', 1, ?, 'manual', 0, ?, ?)`, timestamp, timestamp, timestamp);
      await seedSnapshotWithEvidence(source);
      await seedLocalSnapshotIdCollision(target);

      const backup = await new BackupOrchestrator(source).generateBackup();
      await expect(new BackupOrchestrator(target).restoreMerge(JSON.stringify(backup)))
        .resolves.toMatchObject({ success: true });

      const imported = await target.getFirstAsync(
        "SELECT id FROM calendar_evidence_intervals WHERE name='Imported evidence'",
      ) as { id: string } | null;
      expect(imported?.id).toBeDefined();
      expect(imported?.id).not.toBe('evidence-collision');
      const snapshot = await target.getFirstAsync(
        "SELECT is_current, result_json FROM salary_calculation_snapshots WHERE shift_id='imported-shift'",
      ) as { is_current: number; result_json: string } | null;
      expect(snapshot?.is_current).toBe(1);
      const snapshotResult = JSON.parse(snapshot!.result_json);
      expect(snapshotResult.specialIntervalEvaluations[0].intervalId)
        .toBe(imported?.id);
      const importedProfile = await target.getFirstAsync(
        "SELECT id FROM salary_profiles WHERE name='Profile'",
      ) as { id: string } | null;
      expect(importedProfile?.id).toBeDefined();
      expect(importedProfile?.id).not.toBe('profile');
      const importedSchedule = await target.getFirstAsync(
        "SELECT id, salary_profile_id, workplace_id, enabled FROM weekly_rest_schedules WHERE label='Imported weekly rest'",
      ) as { id: string; salary_profile_id: string; workplace_id: string; enabled: number } | null;
      expect(importedSchedule).toEqual(expect.objectContaining({
        salary_profile_id: importedProfile?.id, workplace_id: 'wp', enabled: 1,
      }));
      expect(importedSchedule?.id).not.toBe('imported-rest');
      expect(snapshotResult.specialIntervalEvaluations[1]).toMatchObject({
        scheduleId: importedSchedule?.id,
        intervalId: `weekly-rest:${importedSchedule?.id}:2026-09-01`,
      });
      expect(snapshotResult.segments[0].specialIntervalIds).toEqual([
        imported?.id,
        `weekly-rest:${importedSchedule?.id}:2026-09-01`,
      ]);
      const importedRule = await target.getFirstAsync(
        'SELECT id FROM pay_rules WHERE salary_profile_id = ?',
        importedProfile!.id,
      ) as { id: string } | null;
      expect(importedRule?.id).toBeDefined();
      expect(importedRule?.id).not.toBe('rule-collision');
      expect(snapshotResult.appliedRuleIds).toEqual([importedRule?.id]);
      expect(snapshotResult.specialIntervalEvaluations[0].appliedRuleIds).toEqual([importedRule?.id]);
      expect(snapshotResult.segments[0].appliedRuleIds).toEqual([importedRule?.id]);
      expect(await target.getFirstAsync(
        "SELECT shift_id FROM salary_calculation_snapshots WHERE id='snapshot-imported'",
      )).toEqual({ shift_id: 'local-shift' });
      expect(await target.getFirstAsync(
        "SELECT id FROM salary_calculation_snapshots WHERE shift_id='imported-shift'",
      )).not.toEqual({ id: 'snapshot-imported' });
      expect(await target.getFirstAsync(
        "SELECT salary_profile_id FROM calendar_evidence_intervals WHERE name='Imported evidence'",
      )).toEqual({ salary_profile_id: importedProfile?.id });
      expect(await target.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      expect(await target.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
    } finally {
      await source.closeAsync();
      await target.closeAsync();
    }
  });
});

async function seedProfile(db: SQLite.SQLiteDatabase) {
  await db.runAsync(`INSERT INTO workplaces (
    id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at
  ) VALUES ('wp', 'Work', 6000, 0, ?, ?)`, timestamp, timestamp);
  await db.runAsync(`INSERT INTO salary_profiles (
    id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
    created_at, updated_at
  ) VALUES ('profile', 'wp', 'Profile', 'ILS', 6000, 'perBreak', 'Asia/Jerusalem', ?, ?)`,
  timestamp, timestamp);
}

async function insertEvidence(db: SQLite.SQLiteDatabase, name: string, updatedAt: string) {
  await db.runAsync(`INSERT INTO calendar_evidence_intervals (
    id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
    source_kind, confirmed_at, created_at, updated_at
  ) VALUES ('evidence-collision', 'wp', 'profile', 'holiday', ?,
    '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
  name, timestamp, timestamp, updatedAt);
}

async function insertSpecialRule(db: SQLite.SQLiteDatabase) {
  await db.runAsync(`INSERT INTO pay_rules (
    id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack,
    premium_family, is_enabled, created_at, updated_at
  ) VALUES ('rule-collision', 'profile', 'Holiday premium', 10,
    '[{"type":"specialInterval","intervalTypes":["holiday"]}]',
    '{"type":"multiplier","basisPoints":15000}', 0, 'special_interval', 1, ?, ?)`,
  timestamp, timestamp);
}

async function seedLocalSnapshotIdCollision(db: SQLite.SQLiteDatabase) {
  await seedSnapshotWithEvidence(db, 'local-shift');
}

async function seedSnapshotWithEvidence(
  db: SQLite.SQLiteDatabase,
  shiftId = 'imported-shift',
) {
  const start = '2026-09-01T08:00:00Z';
  const end = '2026-09-01T09:00:00Z';
  await db.runAsync(`INSERT INTO shifts (
    id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, actual_end,
    payable_start, payable_end, expected_break_minutes, payable_break_minutes, status,
    hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
    timezone, created_at, updated_at
  ) VALUES (?, 'wp', 'profile', ?, ?, ?, ?, ?, ?, 0, 0, 'completed',
    6000, 'actual', ?, 'finalized', 'Asia/Jerusalem', ?, ?)`,
  shiftId, start, end, start, end, start, end, end, timestamp, timestamp);
  const result = {
    context: 'completed', calculationTimezone: 'Asia/Jerusalem', sourceRange: { start, end },
    workIntervals: [{ start, end, minutes: 60 }], grossMinutes: 60, paidBreakMinutes: 0,
    unpaidBreakMinutes: 0, payableMinutes: 60, regularMinutes: 0, specialRateMinutes: 60,
    specialIntervalEvaluations: [{
      intervalId: 'evidence-collision', type: 'holiday', name: 'Imported evidence',
      start: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z',
      timezone: 'Asia/Jerusalem', sourceKind: 'manual', confirmedAt: timestamp,
      appliedRuleIds: ['rule-collision'], contributedToEstimate: true,
    }, {
      intervalId: 'weekly-rest:imported-rest:2026-09-01', scheduleId: 'imported-rest',
      type: 'weekly_rest', name: 'Imported weekly rest', start: '2026-09-01T00:00:00Z',
      end: '2026-09-02T00:00:00Z', timezone: 'Asia/Jerusalem', sourceKind: 'manual',
      confirmedAt: timestamp, appliedRuleIds: [], contributedToEstimate: false,
    }],
    segments: [{
      start, end, localDate: '2026-09-01', minutes: 60, baseHourlyRateMinor: 6000,
      multiplierBasisPoints: 10000, basePayMinor: 6000, premiumPayMinor: 0,
      totalPayMinor: 6000, appliedRuleIds: ['rule-collision'], labels: ['Holiday premium'],
      specialIntervalIds: ['evidence-collision', 'weekly-rest:imported-rest:2026-09-01'],
    }],
    basePayMinor: 6000, premiumPayMinor: 0, minimumDurationAdjustmentMinutes: 0,
    minimumDurationAdjustmentMinor: 0, fixedBonusesMinor: 0, reimbursementsMinor: 0,
    totalGrossPayMinor: 6000, resolvedBaseHourlyRateMinor: 6000,
    appliedRuleIds: ['rule-collision'],
    issues: [], explanations: [], calculatedAt: timestamp, engineVersion: 'test',
  };
  await db.runAsync(`INSERT INTO salary_calculation_snapshots (
    id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor,
    payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor,
    fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version,
    calculated_at, is_current, created_at
  ) VALUES ('snapshot-imported', ?, 1, 'finalized', 'completed', 'profile',
    6000, 60, 0, 60, 6000, 0, 0, 0, 6000, ?, 'test', ?, 1, ?)`,
  shiftId, JSON.stringify(result), timestamp, timestamp);
}

function legacyEmptyBackup() {
  const data = {
    salaryProfiles: [], payRules: [], workplaces: [], roles: [], shiftTemplates: [], shifts: [],
    breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [],
    predictionFeedback: [], scheduledNotifications: [], workplaceNotificationOverrides: [],
    exportPresets: [], exportHistory: [], appSettings: [],
  };
  return {
    format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: timestamp,
    timezone: 'UTC', locale: 'en-US',
    counts: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
    data,
  };
}
