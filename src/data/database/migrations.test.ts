import { DATABASE_MIGRATIONS } from '@/data/database/migrations';

describe('database migrations', () => {
  it('uses unique, ascending versions', () => {
    const versions = DATABASE_MIGRATIONS.map((migration) => migration.version);
    expect(versions).toEqual([...new Set(versions)].sort((left, right) => left - right));
  });

  it('creates all Phase 1 persistence tables and active-shift protection', () => {
    const sql = DATABASE_MIGRATIONS.map((migration) => migration.sql).join('\n');

    for (const table of [
      'workplaces',
      'roles',
      'salary_profiles',
      'pay_rules',
      'shift_templates',
      'shifts',
      'break_sessions',
      'app_settings',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
    expect(sql).toContain('CREATE UNIQUE INDEX one_active_shift');
    expect(sql).toContain('hourly_rate_snapshot_minor INTEGER');
    expect(sql).toContain('julianday(scheduled_end) > julianday(scheduled_start)');
    expect(sql).toContain('salary_profile_id TEXT REFERENCES salary_profiles(id)');
  });

  it('adds Phase 2 recurrence storage without changing the initial migration', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 2);

    expect(migration?.name).toBe('shift_management');
    expect(migration?.sql).toContain('CREATE TABLE recurrence_series');
    expect(migration?.sql).toContain('CREATE TABLE recurrence_exceptions');
    expect(migration?.sql).toContain('recurrence_occurrence_unique');
    expect(migration?.sql).toContain('disabled_from TEXT');
    expect(migration?.sql).toContain('ALTER TABLE break_sessions RENAME TO break_sessions_phase1');
    expect(migration?.sql).toContain('scheduled_start TEXT');
    expect(migration?.sql).not.toContain('scheduled_start TEXT NOT NULL');
  });

  it('adds Phase 3 lifecycle metadata and database concurrency guards', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 3);
    expect(migration?.name).toBe('live_shift_tracking');
    expect(migration?.sql).toContain('expected_end TEXT');
    expect(migration?.sql).toContain('active_origin TEXT');
    expect(migration?.sql).toContain('payable_source TEXT');
    expect(migration?.sql).toContain('completed_at TEXT');
    expect(migration?.sql).toContain('CREATE UNIQUE INDEX one_active_break');
    expect(migration?.sql).toContain('prevent_open_break_for_inactive_shift');
    expect(migration?.sql).toContain('CREATE TABLE recurrence_exceptions');
  });

  it('adds Phase 4 versioned salary snapshots without inventing historical totals', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 4);
    expect(migration?.name).toBe('salary_engine');
    expect(migration?.sql).toContain('CREATE TABLE salary_calculation_snapshots');
    expect(migration?.sql).toContain("DEFAULT 'not_calculated'");
    expect(migration?.sql).toContain('one_current_salary_snapshot');
    expect(migration?.sql).toContain('mark_salary_calculation_stale');
    expect(migration?.sql).toContain('mark_later_daily_salary_dependencies_stale');
    expect(migration?.sql).toContain('mark_salary_stale_after_break_insert');
    expect(migration?.sql).toContain('mark_salary_stale_after_break_update');
    expect(migration?.sql).toContain('mark_salary_stale_after_break_delete');
    expect(migration?.sql).toContain('UPDATE salary_profiles SET workplace_id');
    expect(migration?.sql).not.toContain("salary_calculation_status TEXT NOT NULL DEFAULT 'finalized'");
  });
});
