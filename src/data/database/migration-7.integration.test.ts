import type * as SQLite from 'expo-sqlite';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { SqliteShiftTemplateRepository } from '@/data/repositories/sqlite-shift-template-repository';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

async function runUpToVersion(db: SQLite.SQLiteDatabase, version: number) {
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= version) await db.execAsync(migration.sql);
  }
}

describe('Migration 7 shift type compatibility', () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => { db = createRealSqliteDb(); });
  afterEach(async () => { await db.closeAsync(); });

  it('backfills neutral values and preserves snapshots when a type is edited or deleted', async () => {
    await runUpToVersion(db, 6);
    const timestamp = '2026-08-01T00:00:00Z';
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp', 'Work', 6000, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync("INSERT INTO shift_templates (id, name, default_start_time, default_end_time, expected_break_minutes, is_archived, created_at, updated_at) VALUES ('night', 'Legacy night', '22:00', '06:00', 0, 0, ?, ?)", timestamp, timestamp);
    await db.runAsync("INSERT INTO shifts (id, workplace_id, scheduled_start, scheduled_end, expected_break_minutes, status, hourly_rate_snapshot_minor, shift_template_id, salary_calculation_status, timezone, created_at, updated_at) VALUES ('shift', 'wp', '2026-08-01T22:00:00+03:00', '2026-08-02T06:00:00+03:00', 0, 'scheduled', 6000, 'night', 'not_calculated', 'Asia/Jerusalem', ?, ?)", timestamp, timestamp);
    await db.runAsync("INSERT INTO recurrence_series (id, rule_json, template_json, created_at, updated_at) VALUES ('series', '{}', '{\"workplaceId\":\"wp\",\"shiftTemplateId\":\"night\"}', ?, ?)", timestamp, timestamp);

    await db.execAsync(DATABASE_MIGRATIONS.find((migration) => migration.version === 7)!.sql);

    expect(await db.getFirstAsync('SELECT pay_multiplier_basis_points FROM shift_templates WHERE id = ?', 'night')).toEqual({ pay_multiplier_basis_points: 10000 });
    expect(await db.getFirstAsync('SELECT shift_type_name_snapshot, shift_type_pay_multiplier_basis_points FROM shifts WHERE id = ?', 'shift')).toEqual({
      shift_type_name_snapshot: 'Legacy night',
      shift_type_pay_multiplier_basis_points: 10000,
    });
    const migratedSeries = await db.getFirstAsync<{ template_json: string }>('SELECT template_json FROM recurrence_series WHERE id = ?', 'series');
    expect(JSON.parse(migratedSeries!.template_json)).toMatchObject({ shiftTemplateId: 'night', shiftTypeNameSnapshot: 'Legacy night', shiftTypePayMultiplierBasisPoints: 10000 });

    const repository = new SqliteShiftTemplateRepository(db);
    await repository.update('night', { name: 'Night', payMultiplierBasisPoints: 15000 });
    expect(await db.getFirstAsync('SELECT shift_type_name_snapshot, shift_type_pay_multiplier_basis_points FROM shifts WHERE id = ?', 'shift')).toEqual({
      shift_type_name_snapshot: 'Legacy night',
      shift_type_pay_multiplier_basis_points: 10000,
    });

    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized', shift_type_pay_multiplier_basis_points=15000 WHERE id='shift'");
    await repository.delete('night');
    expect(await db.getFirstAsync('SELECT shift_template_id, shift_type_name_snapshot, shift_type_pay_multiplier_basis_points, salary_calculation_status FROM shifts WHERE id = ?', 'shift')).toEqual({
      shift_template_id: null,
      shift_type_name_snapshot: 'Legacy night',
      shift_type_pay_multiplier_basis_points: 15000,
      salary_calculation_status: 'finalized',
    });
    const deletedSeries = await db.getFirstAsync<{ template_json: string }>('SELECT template_json FROM recurrence_series WHERE id = ?', 'series');
    expect(JSON.parse(deletedSeries!.template_json)).toEqual(expect.objectContaining({ shiftTypeNameSnapshot: 'Legacy night', shiftTypePayMultiplierBasisPoints: 10000 }));
    expect(JSON.parse(deletedSeries!.template_json).shiftTemplateId).toBeUndefined();
  });
});
