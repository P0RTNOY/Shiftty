import type * as SQLite from 'expo-sqlite';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

async function runUpToVersion(db: SQLite.SQLiteDatabase, version: number) {
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= version) await db.execAsync(migration.sql);
  }
}

const timestamp = '2026-08-24T00:00:00Z';

async function insertCompletedShift(
  db: SQLite.SQLiteDatabase,
  id: string,
  workplaceId: string,
  profileId: string,
  start: string,
  end: string,
  workweekStartLocalDate?: string,
) {
  await db.runAsync(`INSERT INTO shifts (
    id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, actual_end,
    payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes,
    status, hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
    timezone, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'completed', 6000, 'actual', ?, 'finalized', 'Asia/Jerusalem', ?, ?)`,
  id, workplaceId, profileId, start, end, start, end, start, end, end, timestamp, timestamp);
  await insertSalarySnapshot(db, id, profileId, workweekStartLocalDate);
}

async function insertSalarySnapshot(
  db: SQLite.SQLiteDatabase,
  shiftId: string,
  profileId: string,
  workweekStartLocalDate?: string,
  version = 1,
  status: 'finalized' | 'incomplete' = 'finalized',
  hasWeeklyProvenance = true,
) {
  await db.runAsync(`INSERT INTO salary_calculation_snapshots (
    id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor, payable_minutes,
    regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor, fixed_bonuses_minor,
    reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at
  ) VALUES (?, ?, ?, ?, 'completed', ?, 6000, 60, 60, 0, 6000, 0, 0, 0, ?,
    ?, 'salary-engine-v1', ?, 1, ?)`,
  `snapshot-${shiftId}-${version}`, shiftId, version, status, profileId, status === 'finalized' ? 6000 : null, JSON.stringify({
    historical: true,
    explanations: hasWeeklyProvenance ? ['salary.explanations.weekly_overtime:test-rule:2520:12500:net'] : [],
    ...(workweekStartLocalDate ? { workweekAllocations: [{ startLocalDate: workweekStartLocalDate, netMinutes: 60, grossMinutes: 60 }] } : {}),
  }), timestamp, timestamp);
}

describe('Migration 8 workweek-aware salary compatibility', () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => { db = createRealSqliteDb(); });
  afterEach(async () => { await db.closeAsync(); });

  it('backfills neutral Sunday defaults without changing legacy snapshot data', async () => {
    await runUpToVersion(db, 7);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync("INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, created_at, updated_at) VALUES ('profile', 'wp', 'Legacy', 'ILS', 6000, 'perBreak', ?, ?)", timestamp, timestamp);
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile' WHERE id='wp'");
    await insertCompletedShift(db, 'legacy-shift', 'wp', 'profile', '2026-08-24T08:00:00+03:00', '2026-08-24T09:00:00+03:00');
    const before = await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='legacy-shift'");

    await db.execAsync(DATABASE_MIGRATIONS.find((migration) => migration.version === 8)!.sql);

    expect(await db.getFirstAsync("SELECT workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes, weekly_overtime_multiplier_basis_points, weekly_overtime_basis FROM salary_profiles WHERE id='profile'")).toEqual({
      workweek_start_weekday: 0,
      weekly_overtime_enabled: 0,
      weekly_regular_minutes: null,
      weekly_overtime_multiplier_basis_points: null,
      weekly_overtime_basis: 'net',
    });
    expect(await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='legacy-shift'")).toEqual(before);
    await expect(db.runAsync("UPDATE salary_profiles SET weekly_overtime_enabled=1 WHERE id='profile'"))
      .rejects.toThrow();
  });

  it('stales only later compatible shifts in the same configured workweek and preserves snapshots', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp-a', 'A', 6000, 0, ?, ?), ('wp-b', 'B', 6000, 0, ?, ?)", timestamp, timestamp, timestamp, timestamp);
    for (const [id, workplaceId] of [['profile-a', 'wp-a'], ['profile-other', 'wp-a'], ['profile-b', 'wp-b']] as const) {
      await db.runAsync(`INSERT INTO salary_profiles (
        id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
        workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
        weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
      ) VALUES (?, ?, ?, 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`,
      id, workplaceId, id, timestamp, timestamp);
    }
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile-a' WHERE id='wp-a'");
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile-b' WHERE id='wp-b'");

    await insertCompletedShift(db, 'source', 'wp-a', 'profile-a', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'same-week', 'wp-a', 'profile-a', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'outside-week', 'wp-a', 'profile-a', '2026-09-06T08:00:00+03:00', '2026-09-06T09:00:00+03:00', '2026-09-06');
    await insertCompletedShift(db, 'other-profile', 'wp-a', 'profile-other', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'other-workplace', 'wp-b', 'profile-b', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');

    const snapshotBefore = await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='same-week'");
    await db.runAsync("UPDATE shifts SET payable_end='2026-08-30T10:00:00+03:00' WHERE id='source'");

    const statuses = await db.getAllAsync<{ id: string; salary_calculation_status: string }>(
      "SELECT id, salary_calculation_status FROM shifts ORDER BY id",
    );
    expect(Object.fromEntries(statuses.map((row) => [row.id, row.salary_calculation_status]))).toMatchObject({
      source: 'stale',
      'same-week': 'stale',
      'outside-week': 'finalized',
      'other-profile': 'finalized',
      'other-workplace': 'finalized',
    });
    expect(await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='same-week'")).toEqual(snapshotBefore);
  });

  it('uses frozen weekly provenance after the live weekly configuration is disabled', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES ('profile', 'wp', 'Weekly', 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`, timestamp, timestamp);
    await insertCompletedShift(db, 'source', 'wp', 'profile', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'later', 'wp', 'profile', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');

    await db.runAsync("UPDATE salary_profiles SET weekly_overtime_enabled=0 WHERE id='profile'");
    await db.runAsync("UPDATE shifts SET payable_end='2026-08-30T10:00:00+03:00' WHERE id='source'");

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='later'"))
      .toEqual({ salary_calculation_status: 'stale' });
  });

  it('invalidates later same-workweek snapshots before deleting their predecessor', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES ('profile', 'wp', 'Weekly', 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`, timestamp, timestamp);
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile' WHERE id='wp'");
    await insertCompletedShift(db, 'source', 'wp', 'profile', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'later', 'wp', 'profile', '2026-09-05T08:00:00+03:00', '2026-09-05T09:00:00+03:00', '2026-08-30');
    const laterSnapshot = await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='later'");

    await db.runAsync("DELETE FROM shifts WHERE id='source'");

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='later'")).toEqual({ salary_calculation_status: 'stale' });
    expect(await db.getFirstAsync<{ result_json: string }>("SELECT result_json FROM salary_calculation_snapshots WHERE shift_id='later'")).toEqual(laterSnapshot);
  });

  it('invalidates a later snapshot when an earlier historical completed snapshot is added', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES ('profile', 'wp', 'Weekly', 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`, timestamp, timestamp);
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile' WHERE id='wp'");
    await insertCompletedShift(db, 'later', 'wp', 'profile', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');

    await db.runAsync(`INSERT INTO shifts (
      id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, actual_end,
      payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes,
      status, hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
      timezone, created_at, updated_at
    ) VALUES ('historical', 'wp', 'profile', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00',
      '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30T08:00:00+03:00',
      '2026-08-30T09:00:00+03:00', 0, 0, 0, 'completed', 6000, 'actual',
      '2026-08-30T09:00:00+03:00', 'not_calculated', 'Asia/Jerusalem', ?, ?)`, timestamp, timestamp);
    await insertSalarySnapshot(db, 'historical', 'profile', '2026-08-30');

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='later'"))
      .toEqual({ salary_calculation_status: 'stale' });
  });

  it('invalidates a later snapshot when an earlier scheduled shift is completed and snapshotted', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES ('profile', 'wp', 'Weekly', 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`, timestamp, timestamp);
    await insertCompletedShift(db, 'later', 'wp', 'profile', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');
    await db.runAsync(`INSERT INTO shifts (
      id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, expected_break_minutes,
      status, hourly_rate_snapshot_minor, salary_calculation_status, timezone, created_at, updated_at
    ) VALUES ('scheduled-source', 'wp', 'profile', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00',
      0, 'scheduled', 6000, 'not_calculated', 'Asia/Jerusalem', ?, ?)`, timestamp, timestamp);

    await db.runAsync(`UPDATE shifts SET
      status='completed', actual_start=scheduled_start, actual_end=scheduled_end,
      payable_start=scheduled_start, payable_end=scheduled_end, payable_break_minutes=0,
      payable_source='actual', completed_at=scheduled_end
      WHERE id='scheduled-source'`);
    await insertSalarySnapshot(db, 'scheduled-source', 'profile', '2026-08-30');

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='later'"))
      .toEqual({ salary_calculation_status: 'stale' });
  });

  it('invalidates the destination cohort when a moved predecessor gets its new snapshot', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp-a', 'A', 6000, 0, ?, ?), ('wp-b', 'B', 6000, 0, ?, ?)", timestamp, timestamp, timestamp, timestamp);
    for (const [id, workplaceId] of [['profile-a', 'wp-a'], ['profile-b', 'wp-b']] as const) {
      await db.runAsync(`INSERT INTO salary_profiles (
        id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
        workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
        weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
      ) VALUES (?, ?, ?, 'ILS', 6000, 'perBreak', 0, 1, 2520, 12500, 'net', ?, ?)`,
      id, workplaceId, id, timestamp, timestamp);
    }
    await insertCompletedShift(db, 'source', 'wp-a', 'profile-a', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'destination-later', 'wp-b', 'profile-b', '2026-09-04T08:00:00+03:00', '2026-09-04T09:00:00+03:00', '2026-08-30');

    await db.runAsync("UPDATE shifts SET workplace_id='wp-b', salary_profile_id='profile-b' WHERE id='source'");
    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='destination-later'"))
      .toEqual({ salary_calculation_status: 'finalized' });
    await db.runAsync("UPDATE salary_calculation_snapshots SET is_current=0 WHERE shift_id='source'");
    await insertSalarySnapshot(db, 'source', 'profile-b', '2026-08-30', 2);

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='destination-later'"))
      .toEqual({ salary_calculation_status: 'stale' });
  });

  it('does not create weekly dependencies while weekly overtime is disabled', async () => {
    await runUpToVersion(db, 8);
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync(`INSERT INTO salary_profiles (
      id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy,
      workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points, weekly_overtime_basis, created_at, updated_at
    ) VALUES ('profile', 'wp', 'Disabled', 'ILS', 6000, 'perBreak', 0, 0, 2520, 12500, 'net', ?, ?)`, timestamp, timestamp);
    await db.runAsync("UPDATE workplaces SET salary_profile_id='profile' WHERE id='wp'");
    await insertCompletedShift(db, 'source', 'wp', 'profile', '2026-08-30T08:00:00+03:00', '2026-08-30T09:00:00+03:00', '2026-08-30');
    await insertCompletedShift(db, 'later', 'wp', 'profile', '2026-09-05T08:00:00+03:00', '2026-09-05T09:00:00+03:00', '2026-08-30');
    await db.runAsync("UPDATE salary_calculation_snapshots SET result_json=json_set(result_json, '$.explanations', json('[]')) WHERE shift_id IN ('source', 'later')");

    await db.runAsync("UPDATE shifts SET payable_end='2026-08-30T10:00:00+03:00' WHERE id='source'");

    expect(await db.getFirstAsync("SELECT salary_calculation_status FROM shifts WHERE id='later'"))
      .toEqual({ salary_calculation_status: 'finalized' });
  });
});
