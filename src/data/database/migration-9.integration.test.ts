import type * as SQLite from 'expo-sqlite';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

const timestamp = '2026-08-24T00:00:00Z';

async function runUpToVersion(db: SQLite.SQLiteDatabase, version: number) {
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= version) await db.execAsync(migration.sql);
  }
}

async function seedWorkplaceAndProfile(
  db: SQLite.SQLiteDatabase,
  workplaceId: string,
  profileId: string,
) {
  await db.runAsync(
    'INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 6000, ?, ?)',
    workplaceId,
    workplaceId,
    timestamp,
    timestamp,
  );
  await db.runAsync(
    `INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor,
      break_policy, timezone, created_at, updated_at) VALUES (?, ?, ?, 'ILS', 6000, 'perBreak',
      'Asia/Jerusalem', ?, ?)`,
    profileId,
    workplaceId,
    profileId,
    timestamp,
    timestamp,
  );
}

async function seedFinalizedShift(
  db: SQLite.SQLiteDatabase,
  id: string,
  workplaceId: string,
  profileId: string,
  start: string,
  end: string,
) {
  await db.runAsync(`INSERT INTO shifts (
    id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, actual_end,
    payable_start, payable_end, expected_break_minutes, payable_break_minutes, status,
    hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
    timezone, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'completed', 6000, 'actual', ?, 'finalized',
    'Asia/Jerusalem', ?, ?)`, id, workplaceId, profileId, start, end, start, end, start, end,
  end, timestamp, timestamp);
  await db.runAsync(`INSERT INTO salary_calculation_snapshots (
    id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor,
    payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor,
    fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version,
    calculated_at, is_current, created_at
  ) VALUES (?, ?, 1, 'finalized', 'completed', ?, 6000, 60, 60, 0, 6000, 0, 0, 0,
    6000, '{}', 'test', ?, 1, ?)`, `snapshot-${id}`, id, profileId, timestamp, timestamp);
}

describe('Migration 9 evidence-aware holiday/rest persistence', () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => { db = createRealSqliteDb(); });
  afterEach(async () => { await db.closeAsync(); });

  it('upgrades neutrally without activating rest or rewriting historical snapshots', async () => {
    await runUpToVersion(db, 8);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    await db.runAsync(`INSERT INTO pay_rules (
      id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack,
      is_enabled, created_at, updated_at
    ) VALUES ('legacy-rule', 'profile', 'Legacy', 1, '[]',
      '{"type":"multiplier","basisPoints":12500}', 0, 1, ?, ?)`, timestamp, timestamp);
    await seedFinalizedShift(db, 'legacy', 'wp', 'profile', '2026-08-24T08:00:00Z', '2026-08-24T09:00:00Z');
    const before = await db.getFirstAsync<{ result_json: string; total_gross_pay_minor: number }>(
      "SELECT result_json, total_gross_pay_minor FROM salary_calculation_snapshots WHERE shift_id='legacy'",
    );

    await db.execAsync(DATABASE_MIGRATIONS.find((migration) => migration.version === 9)!.sql);

    expect(await db.getFirstAsync('SELECT count(*) AS count FROM calendar_evidence_intervals')).toEqual({ count: 0 });
    expect(await db.getFirstAsync('SELECT count(*) AS count FROM weekly_rest_schedules')).toEqual({ count: 0 });
    expect(await db.getFirstAsync("SELECT premium_family FROM pay_rules WHERE id='legacy-rule'"))
      .toEqual({ premium_family: null });
    expect(await db.getFirstAsync("SELECT result_json, total_gross_pay_minor FROM salary_calculation_snapshots WHERE shift_id='legacy'"))
      .toEqual(before);
  });

  it('enforces bounded intervals, one schedule per profile, and workplace/profile isolation', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp-a', 'profile-a');
    await seedWorkplaceAndProfile(db, 'wp-b', 'profile-b');

    await expect(db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('cross', 'wp-a', 'profile-b', 'holiday', 'Cross', ?, ?, 'Asia/Jerusalem',
      'manual', ?, ?, ?)`, timestamp, '2026-08-25T00:00:00Z', timestamp, timestamp, timestamp))
      .rejects.toThrow('evidence interval profile must belong to its workplace');

    await expect(db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, interval_type, name, start_at, end_at, timezone, source_kind,
      confirmed_at, created_at, updated_at
    ) VALUES ('zero', 'wp-a', 'holiday', 'Zero', ?, ?, 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp, timestamp, timestamp)).rejects.toThrow();

    await db.runAsync(`INSERT INTO weekly_rest_schedules (
      id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
      end_time, enabled, source_kind, created_at, updated_at
    ) VALUES ('rest-a', 'wp-a', 'profile-a', 'Rest', 5, '18:00', 6, '18:00', 0, 'manual', ?, ?)`,
    timestamp, timestamp);
    await expect(db.runAsync(`INSERT INTO weekly_rest_schedules (
      id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
      end_time, enabled, source_kind, created_at, updated_at
    ) VALUES ('rest-b', 'wp-a', 'profile-a', 'Rest 2', 4, '18:00', 5, '18:00', 0, 'manual', ?, ?)`,
    timestamp, timestamp)).rejects.toThrow();

    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, schedule_id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at,
      timezone, source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('scheduled-rest', 'rest-a', 'wp-a', 'profile-a', 'weekly_rest', 'Rest occurrence',
      '2026-08-28T15:00:00Z', '2026-08-29T15:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);
    await expect(db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, schedule_id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at,
      timezone, source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('mismatched-rest', 'rest-a', 'wp-b', 'profile-b', 'weekly_rest', 'Wrong scope',
      '2026-08-28T15:00:00Z', '2026-08-29T15:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp))
      .rejects.toThrow('evidence interval schedule must match its workplace and profile');

    await db.runAsync("DELETE FROM weekly_rest_schedules WHERE id='rest-a'");
    expect(await db.getFirstAsync("SELECT schedule_id FROM calendar_evidence_intervals WHERE id='scheduled-rest'"))
      .toEqual({ schedule_id: null });

    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('rejects malformed and out-of-range weekly-rest local times', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    const invalidTimes = [
      ['aa:bb', '18:00'],
      ['1x:2y', '18:00'],
      ['24:00', '18:00'],
      ['18:00', '23:60'],
    ] as const;

    for (const [index, [startTime, endTime]] of invalidTimes.entries()) {
      await expect(db.runAsync(`INSERT INTO weekly_rest_schedules (
        id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
        end_time, enabled, source_kind, created_at, updated_at
      ) VALUES (?, 'wp', 'profile', 'Invalid rest', 5, ?, 6, ?, 0, 'manual', ?, ?)`,
      `invalid-${index}`, startTime, endTime, timestamp, timestamp)).rejects.toThrow();
    }

    expect(await db.getFirstAsync('SELECT count(*) AS count FROM weekly_rest_schedules'))
      .toEqual({ count: 0 });
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('prevents moving a salary profile away from evidence and weekly-rest children', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp-a', 'profile-a');
    await seedWorkplaceAndProfile(db, 'wp-b', 'profile-b');
    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('profile-evidence', 'wp-a', 'profile-a', 'holiday', 'Holiday',
      '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);

    await expect(db.runAsync("UPDATE salary_profiles SET workplace_id='wp-b' WHERE id='profile-a'"))
      .rejects.toThrow('salary profile move would strand evidence configuration');
    await db.runAsync("DELETE FROM calendar_evidence_intervals WHERE id='profile-evidence'");
    await db.runAsync(`INSERT INTO weekly_rest_schedules (
      id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
      end_time, enabled, source_kind, created_at, updated_at
    ) VALUES ('profile-rest', 'wp-a', 'profile-a', 'Rest', 5, '18:00', 6, '18:00',
      0, 'manual', ?, ?)`, timestamp, timestamp);

    await expect(db.runAsync("UPDATE salary_profiles SET workplace_id='wp-b' WHERE id='profile-a'"))
      .rejects.toThrow('salary profile move would strand evidence configuration');
    expect(await db.getFirstAsync("SELECT workplace_id FROM salary_profiles WHERE id='profile-a'"))
      .toEqual({ workplace_id: 'wp-a' });
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('stales only finalized shifts in the exact half-open interval and compatible profile', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp-a', 'profile-a');
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
      created_at, updated_at
    ) VALUES ('profile-other', 'wp-a', 'Other', 'ILS', 6000, 'perBreak', 'Asia/Jerusalem', ?, ?)`,
    timestamp, timestamp);
    await seedWorkplaceAndProfile(db, 'wp-b', 'profile-b');
    await seedFinalizedShift(db, 'inside', 'wp-a', 'profile-a', '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z');
    await seedFinalizedShift(db, 'ends-at-start', 'wp-a', 'profile-a', '2026-08-24T06:00:00Z', '2026-08-24T08:00:00Z');
    await seedFinalizedShift(db, 'starts-at-end', 'wp-a', 'profile-a', '2026-08-24T10:00:00Z', '2026-08-24T12:00:00Z');
    await seedFinalizedShift(db, 'other-profile', 'wp-a', 'profile-other', '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z');
    await seedFinalizedShift(db, 'other-workplace', 'wp-b', 'profile-b', '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z');

    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('holiday', 'wp-a', 'profile-a', 'holiday', 'Holiday',
      '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);

    const statuses = await db.getAllAsync<{ id: string; salary_calculation_status: string }>(
      'SELECT id, salary_calculation_status FROM shifts ORDER BY id',
    );
    expect(Object.fromEntries(statuses.map((row) => [row.id, row.salary_calculation_status])))
      .toEqual({
        'ends-at-start': 'finalized', inside: 'stale', 'other-profile': 'finalized',
        'other-workplace': 'finalized', 'starts-at-end': 'finalized',
      });
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('stales the union of old and new ranges when a confirmed preset replaces interval boundaries', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
      created_at, updated_at
    ) VALUES ('other-profile', 'wp', 'Other', 'ILS', 6000, 'perBreak', 'Asia/Jerusalem', ?, ?)`,
    timestamp, timestamp);
    await seedFinalizedShift(db, 'old-only', 'wp', 'profile', '2026-08-24T08:00:00Z', '2026-08-24T09:00:00Z');
    await seedFinalizedShift(db, 'both', 'wp', 'profile', '2026-08-24T09:00:00Z', '2026-08-24T10:00:00Z');
    await seedFinalizedShift(db, 'new-only', 'wp', 'profile', '2026-08-24T10:00:00Z', '2026-08-24T11:00:00Z');
    await seedFinalizedShift(db, 'outside', 'wp', 'profile', '2026-08-24T12:00:00Z', '2026-08-24T13:00:00Z');
    await seedFinalizedShift(db, 'other-profile', 'wp', 'other-profile', '2026-08-24T08:00:00Z', '2026-08-24T11:00:00Z');
    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('replaceable', 'wp', 'profile', 'holiday', 'Manual date',
      '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);
    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized'");
    const snapshotsBefore = await db.getAllAsync<{ id: string; result_json: string }>(
      'SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id',
    );

    await db.runAsync(`UPDATE calendar_evidence_intervals SET
      name='Confirmed preset date', start_at='2026-08-24T09:00:00Z', end_at='2026-08-24T11:00:00Z',
      source_kind='confirmed_preset', source_title='Reviewed source', source_url='https://example.gov/date',
      preset_id='replacement-fixture', preset_version='2', updated_at=? WHERE id='replaceable'`, timestamp);

    const statuses = await db.getAllAsync<{ id: string; salary_calculation_status: string }>(
      'SELECT id, salary_calculation_status FROM shifts ORDER BY id',
    );
    expect(Object.fromEntries(statuses.map((row) => [row.id, row.salary_calculation_status]))).toEqual({
      both: 'stale', 'new-only': 'stale', 'old-only': 'stale', 'other-profile': 'finalized', outside: 'finalized',
    });
    expect(await db.getAllAsync('SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id'))
      .toEqual(snapshotsBefore);
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('archives and deletes evidence with targeted staleness while preserving frozen snapshots', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    await seedFinalizedShift(db, 'affected', 'wp', 'profile', '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z');
    await seedFinalizedShift(db, 'unrelated', 'wp', 'profile', '2026-08-24T11:00:00Z', '2026-08-24T12:00:00Z');
    const frozenEvaluation = {
      intervalId: 'archivable', type: 'holiday', name: 'Frozen holiday',
      start: '2026-08-24T08:30:00Z', end: '2026-08-24T09:30:00Z', timezone: 'Asia/Jerusalem',
      sourceKind: 'confirmed_preset', sourceTitle: 'Reviewed source', sourceUrl: 'https://example.gov/date',
      presetId: 'historical-fixture', presetVersion: '1', confirmedAt: timestamp,
      appliedRuleIds: ['holiday-rule'], contributedToEstimate: true,
    };
    await db.runAsync(`UPDATE salary_calculation_snapshots SET result_json=? WHERE shift_id='affected'`,
      JSON.stringify({ specialIntervalEvaluations: [frozenEvaluation] }));
    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('archivable', 'wp', 'profile', 'holiday', 'Frozen holiday',
      '2026-08-24T08:30:00Z', '2026-08-24T09:30:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);
    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized'");
    const frozen = await db.getFirstAsync<{ result_json: string }>(
      "SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='affected'",
    );

    await db.runAsync(`UPDATE calendar_evidence_intervals SET is_archived=1, archived_at=?, updated_at=?
      WHERE id='archivable'`, timestamp, timestamp);
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='affected'"))
      .toEqual({ salary_calculation_status: 'stale' });
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='unrelated'"))
      .toEqual({ salary_calculation_status: 'finalized' });
    expect(await db.getFirstAsync("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='affected'"))
      .toEqual(frozen);

    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized' WHERE id='affected'");
    await db.runAsync("DELETE FROM calendar_evidence_intervals WHERE id='archivable'");
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='affected'"))
      .toEqual({ salary_calculation_status: 'stale' });
    expect(JSON.parse((await db.getFirstAsync<{ result_json: string }>(
      "SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='affected'",
    ))!.result_json)).toEqual({ specialIntervalEvaluations: [frozenEvaluation] });
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('does not range-stale a recalculated shift when archived evidence without frozen provenance is deleted', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    await seedFinalizedShift(db, 'recalculated', 'wp', 'profile',
      '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z');
    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('archived-no-reference', 'wp', 'profile', 'holiday', 'Old holiday',
      '2026-08-24T08:30:00Z', '2026-08-24T09:30:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);
    await db.runAsync(`UPDATE calendar_evidence_intervals
      SET is_archived=1, archived_at=?, updated_at=? WHERE id='archived-no-reference'`,
    timestamp, timestamp);
    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized' WHERE id='recalculated'");

    await db.runAsync("DELETE FROM calendar_evidence_intervals WHERE id='archived-no-reference'");

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='recalculated'"))
      .toEqual({ salary_calculation_status: 'finalized' });
    expect(await db.getFirstAsync("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='recalculated'"))
      .toEqual({ result_json: '{}' });
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('marks a completed shift stale when it moves into or out of an affected interval', async () => {
    await runUpToVersion(db, 9);
    await seedWorkplaceAndProfile(db, 'wp', 'profile');
    await seedFinalizedShift(db, 'moved', 'wp', 'profile', '2026-08-24T06:00:00Z', '2026-08-24T07:00:00Z');
    await db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, confirmed_at, created_at, updated_at
    ) VALUES ('holiday', 'wp', 'profile', 'holiday', 'Holiday',
      '2026-08-24T08:00:00Z', '2026-08-24T10:00:00Z', 'Asia/Jerusalem', 'manual', ?, ?, ?)`,
    timestamp, timestamp, timestamp);
    const frozen = await db.getFirstAsync<{ result_json: string }>(
      "SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='moved'",
    );

    await db.runAsync(`UPDATE shifts SET payable_start='2026-08-24T08:30:00Z',
      payable_end='2026-08-24T09:30:00Z' WHERE id='moved'`);
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='moved'"))
      .toEqual({ salary_calculation_status: 'stale' });

    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized' WHERE id='moved'");
    await db.runAsync(`UPDATE shifts SET payable_start='2026-08-24T11:00:00Z',
      payable_end='2026-08-24T12:00:00Z' WHERE id='moved'`);
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='moved'"))
      .toEqual({ salary_calculation_status: 'stale' });
    expect(await db.getFirstAsync("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='moved'"))
      .toEqual(frozen);
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });
});
