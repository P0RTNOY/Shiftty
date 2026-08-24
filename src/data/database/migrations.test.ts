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

  it('adds Phase 5 smart assistance tables and extends shift_templates', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 5);
    expect(migration?.name).toBe('smart_assistance');
    expect(migration?.sql).toContain('ALTER TABLE shift_templates ADD COLUMN valid_weekdays');
    expect(migration?.sql).toContain('ALTER TABLE shift_templates ADD COLUMN expected_break_type');
    expect(migration?.sql).toContain('ALTER TABLE shift_templates ADD COLUMN color_token');
    expect(migration?.sql).toContain('ALTER TABLE shift_templates ADD COLUMN is_archived');
    expect(migration?.sql).toContain('ALTER TABLE shift_templates ADD COLUMN expected_duration_minutes');
    expect(migration?.sql).toContain('CREATE TABLE prediction_feedback');
    expect(migration?.sql).toContain('CREATE TABLE workplace_notification_overrides');
    expect(migration?.sql).toContain('CREATE TABLE scheduled_notification_records');
    expect(migration?.sql).toContain("feedback_type TEXT NOT NULL CHECK (feedback_type IN ('accepted_all', 'accepted_partial', 'rejected', 'edited_after_acceptance'))");
    expect(migration?.sql).toContain("type TEXT NOT NULL CHECK (type IN ('shift_reminder', 'missed_clock_in', 'expected_end_soon', 'expected_end', 'overdue_shift', 'long_break', 'daily_summary'))");
    expect(migration?.sql).toContain('shift_templates_active');
    expect(migration?.sql).toContain('json_valid(accepted_fields_json)');
  });

  it('adds backward-compatible shift type pay multipliers and historical snapshots', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 7);
    expect(migration?.name).toBe('shift_type_pay_multipliers');
    expect(migration?.sql).toContain('pay_multiplier_basis_points INTEGER NOT NULL DEFAULT 10000');
    expect(migration?.sql).toContain('shift_type_name_snapshot TEXT');
    expect(migration?.sql).toContain('shift_type_pay_multiplier_basis_points INTEGER NOT NULL DEFAULT 10000');
    expect(migration?.sql).toContain('UPDATE recurrence_series');
    expect(migration?.sql).toContain('shift_type_pay_multiplier_basis_points ON shifts');
  });

  it('adds opt-in workweek configuration and scoped dependency invalidation', () => {
    const migration = DATABASE_MIGRATIONS.find((item) => item.version === 8);
    expect(migration?.name).toBe('workweek_aware_salary');
    expect(migration?.sql).toContain('workweek_start_weekday INTEGER NOT NULL DEFAULT 0');
    expect(migration?.sql).toContain('weekly_overtime_enabled INTEGER NOT NULL DEFAULT 0');
    expect(migration?.sql).toContain('weekly_regular_minutes INTEGER');
    expect(migration?.sql).toContain('weekly_overtime_multiplier_basis_points INTEGER');
    expect(migration?.sql).toContain("weekly_overtime_basis TEXT NOT NULL DEFAULT 'net'");
    expect(migration?.sql).toContain("json_each(target_snapshot.result_json, '$.workweekAllocations')");
    expect(migration?.sql).toContain('mark_later_weekly_salary_dependencies_stale');
    expect(migration?.sql).toContain('mark_later_weekly_salary_dependencies_stale_after_snapshot_insert');
    expect(migration?.sql).toContain('mark_later_salary_dependencies_stale_before_delete');
    expect(migration?.sql).not.toContain('UPDATE salary_calculation_snapshots SET result_json');
  });
});
