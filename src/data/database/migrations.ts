export interface DatabaseMigration {
  version: number;
  name: string;
  sql: string;
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE salary_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ILS',
        standard_hourly_rate_minor INTEGER NOT NULL CHECK (standard_hourly_rate_minor >= 0),
        break_policy TEXT NOT NULL CHECK (break_policy IN ('paid', 'unpaid', 'perBreak')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workplaces (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        default_hourly_rate_minor INTEGER NOT NULL CHECK (default_hourly_rate_minor >= 0),
        default_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (default_break_minutes >= 0),
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE roles (
        id TEXT PRIMARY KEY NOT NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        hourly_rate_minor INTEGER CHECK (hourly_rate_minor >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pay_rules (
        id TEXT PRIMARY KEY NOT NULL,
        salary_profile_id TEXT NOT NULL REFERENCES salary_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        priority INTEGER NOT NULL,
        conditions_json TEXT NOT NULL CHECK (json_valid(conditions_json)),
        effect_json TEXT NOT NULL CHECK (json_valid(effect_json)),
        can_stack INTEGER NOT NULL CHECK (can_stack IN (0, 1)),
        effective_from TEXT,
        effective_to TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE shift_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        default_start_time TEXT NOT NULL,
        default_end_time TEXT NOT NULL,
        expected_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (expected_break_minutes >= 0),
        workplace_id TEXT REFERENCES workplaces(id) ON DELETE SET NULL,
        role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE shifts (
        id TEXT PRIMARY KEY NOT NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT,
        role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        title TEXT,
        notes TEXT,
        scheduled_start TEXT NOT NULL,
        scheduled_end TEXT NOT NULL,
        actual_start TEXT,
        actual_end TEXT,
        payable_start TEXT,
        payable_end TEXT,
        expected_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (expected_break_minutes >= 0),
        actual_break_minutes INTEGER CHECK (actual_break_minutes >= 0),
        payable_break_minutes INTEGER CHECK (payable_break_minutes >= 0),
        status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'completed', 'missed', 'cancelled')),
        hourly_rate_snapshot_minor INTEGER NOT NULL CHECK (hourly_rate_snapshot_minor >= 0),
        expected_gross_pay_minor INTEGER CHECK (expected_gross_pay_minor >= 0),
        actual_gross_pay_minor INTEGER CHECK (actual_gross_pay_minor >= 0),
        payable_gross_pay_minor INTEGER CHECK (payable_gross_pay_minor >= 0),
        recurrence_group_id TEXT,
        timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (julianday(scheduled_end) > julianday(scheduled_start)),
        CHECK (
          actual_end IS NULL OR
          (actual_start IS NOT NULL AND julianday(actual_end) > julianday(actual_start))
        ),
        CHECK (
          payable_end IS NULL OR
          (payable_start IS NOT NULL AND julianday(payable_end) > julianday(payable_start))
        )
      );

      CREATE UNIQUE INDEX one_active_shift ON shifts(status) WHERE status = 'active';
      CREATE INDEX shifts_scheduled_range ON shifts(scheduled_start, scheduled_end);
      CREATE INDEX shifts_workplace ON shifts(workplace_id);
      CREATE INDEX shifts_recurrence_group ON shifts(recurrence_group_id);

      CREATE TABLE break_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        start_at TEXT NOT NULL,
        end_at TEXT,
        is_paid INTEGER NOT NULL CHECK (is_paid IN (0, 1)),
        source TEXT NOT NULL CHECK (source IN ('tracked', 'manual')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (end_at IS NULL OR julianday(end_at) > julianday(start_at))
      );

      CREATE INDEX break_sessions_shift ON break_sessions(shift_id, start_at);

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL CHECK (json_valid(value_json)),
        updated_at TEXT NOT NULL
      );
    `,
  },
];
