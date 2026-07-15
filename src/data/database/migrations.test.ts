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
});
