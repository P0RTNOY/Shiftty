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
  {
    version: 2,
    name: 'shift_management',
    sql: `
      DROP INDEX one_active_shift;
      DROP INDEX shifts_scheduled_range;
      DROP INDEX shifts_workplace;
      DROP INDEX shifts_recurrence_group;
      DROP INDEX break_sessions_shift;

      PRAGMA legacy_alter_table = ON;
      ALTER TABLE shifts RENAME TO shifts_phase1;

      CREATE TABLE shifts (
        id TEXT PRIMARY KEY NOT NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT,
        role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        title TEXT,
        notes TEXT,
        scheduled_start TEXT,
        scheduled_end TEXT,
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
        shift_template_id TEXT REFERENCES shift_templates(id) ON DELETE SET NULL,
        recurrence_group_id TEXT,
        recurrence_original_start TEXT,
        recurrence_exception_type TEXT CHECK (recurrence_exception_type IN ('modified')),
        cancelled_at TEXT,
        timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (scheduled_start IS NULL AND scheduled_end IS NULL) OR
          (scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL AND julianday(scheduled_end) > julianday(scheduled_start))
        ),
        CHECK (status = 'completed' OR scheduled_start IS NOT NULL),
        CHECK (actual_end IS NULL OR (actual_start IS NOT NULL AND julianday(actual_end) > julianday(actual_start))),
        CHECK (payable_end IS NULL OR (payable_start IS NOT NULL AND julianday(payable_end) > julianday(payable_start)))
      );

      INSERT INTO shifts (
        id, workplace_id, role_id, salary_profile_id, title, notes,
        scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end,
        expected_break_minutes, actual_break_minutes, payable_break_minutes, status,
        hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor,
        payable_gross_pay_minor, recurrence_group_id, timezone, created_at, updated_at
      ) SELECT
        id, workplace_id, role_id, salary_profile_id, title, notes,
        scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end,
        expected_break_minutes, actual_break_minutes, payable_break_minutes, status,
        hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor,
        payable_gross_pay_minor, recurrence_group_id, timezone, created_at, updated_at
      FROM shifts_phase1;

      ALTER TABLE break_sessions RENAME TO break_sessions_phase1;

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

      INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, created_at, updated_at)
      SELECT id, shift_id, start_at, end_at, is_paid, source, created_at, updated_at
      FROM break_sessions_phase1;

      DROP TABLE break_sessions_phase1;
      DROP TABLE shifts_phase1;
      PRAGMA legacy_alter_table = OFF;

      CREATE UNIQUE INDEX one_active_shift ON shifts(status) WHERE status = 'active';
      CREATE INDEX shifts_effective_range ON shifts(
        COALESCE(scheduled_start, actual_start, payable_start),
        COALESCE(scheduled_end, actual_end, payable_end)
      );
      CREATE INDEX shifts_workplace ON shifts(workplace_id);
      CREATE INDEX shifts_recurrence_group ON shifts(recurrence_group_id);
      CREATE UNIQUE INDEX recurrence_occurrence_unique
        ON shifts(recurrence_group_id, recurrence_original_start)
        WHERE recurrence_group_id IS NOT NULL AND recurrence_original_start IS NOT NULL;
      CREATE INDEX break_sessions_shift ON break_sessions(shift_id, start_at);

      CREATE TABLE recurrence_series (
        id TEXT PRIMARY KEY NOT NULL,
        rule_json TEXT NOT NULL CHECK (json_valid(rule_json)),
        template_json TEXT NOT NULL CHECK (json_valid(template_json)),
        disabled_from TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE recurrence_exceptions (
        id TEXT PRIMARY KEY NOT NULL,
        series_id TEXT NOT NULL REFERENCES recurrence_series(id) ON DELETE CASCADE,
        local_date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('deleted', 'modified')),
        shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE(series_id, local_date)
      );
    `,
  },
  {
    version: 3,
    name: 'live_shift_tracking',
    sql: `
      DROP INDEX one_active_shift;
      DROP INDEX shifts_effective_range;
      DROP INDEX shifts_workplace;
      DROP INDEX shifts_recurrence_group;
      DROP INDEX recurrence_occurrence_unique;
      DROP INDEX break_sessions_shift;

      PRAGMA legacy_alter_table = ON;
      ALTER TABLE recurrence_exceptions RENAME TO recurrence_exceptions_phase2;
      ALTER TABLE break_sessions RENAME TO break_sessions_phase2;
      ALTER TABLE shifts RENAME TO shifts_phase2;

      CREATE TABLE shifts (
        id TEXT PRIMARY KEY NOT NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT,
        role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        title TEXT,
        notes TEXT,
        scheduled_start TEXT,
        scheduled_end TEXT,
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
        shift_template_id TEXT REFERENCES shift_templates(id) ON DELETE SET NULL,
        recurrence_group_id TEXT,
        recurrence_original_start TEXT,
        recurrence_exception_type TEXT CHECK (recurrence_exception_type IN ('modified')),
        cancelled_at TEXT,
        expected_end TEXT,
        active_origin TEXT CHECK (active_origin IN ('scheduled', 'unscheduled')),
        payable_source TEXT CHECK (payable_source IN ('actual', 'scheduled', 'rounded', 'manual')),
        completed_at TEXT,
        timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((scheduled_start IS NULL AND scheduled_end IS NULL) OR (scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL AND julianday(scheduled_end) > julianday(scheduled_start))),
        CHECK (status NOT IN ('scheduled', 'missed') OR scheduled_start IS NOT NULL),
        CHECK (status != 'active' OR (actual_start IS NOT NULL AND actual_end IS NULL AND active_origin IS NOT NULL)),
        CHECK (status != 'completed' OR (actual_start IS NOT NULL AND actual_end IS NOT NULL AND payable_start IS NOT NULL AND payable_end IS NOT NULL AND payable_source IS NOT NULL AND completed_at IS NOT NULL)),
        CHECK (actual_end IS NULL OR (actual_start IS NOT NULL AND julianday(actual_end) > julianday(actual_start))),
        CHECK (payable_end IS NULL OR (payable_start IS NOT NULL AND julianday(payable_end) > julianday(payable_start)))
      );

      INSERT INTO shifts (
        id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, expected_break_minutes, actual_break_minutes,
        payable_break_minutes, status, hourly_rate_snapshot_minor, expected_gross_pay_minor,
        actual_gross_pay_minor, payable_gross_pay_minor, shift_template_id, recurrence_group_id,
        recurrence_original_start, recurrence_exception_type, cancelled_at, expected_end, active_origin,
        payable_source, completed_at, timezone, created_at, updated_at
      ) SELECT
        id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end,
        actual_start, actual_end,
        CASE WHEN status = 'completed' THEN COALESCE(payable_start, actual_start) ELSE payable_start END,
        CASE WHEN status = 'completed' THEN COALESCE(payable_end, actual_end) ELSE payable_end END,
        expected_break_minutes, actual_break_minutes,
        CASE WHEN status = 'completed' THEN COALESCE(payable_break_minutes, actual_break_minutes, 0) ELSE payable_break_minutes END,
        status, hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor,
        payable_gross_pay_minor, shift_template_id, recurrence_group_id, recurrence_original_start,
        recurrence_exception_type, cancelled_at,
        CASE WHEN status = 'active' THEN scheduled_end ELSE NULL END,
        CASE WHEN status = 'active' THEN 'scheduled' ELSE NULL END,
        CASE WHEN status = 'completed' THEN 'actual' ELSE NULL END,
        CASE WHEN status = 'completed' THEN COALESCE(actual_end, updated_at) ELSE NULL END,
        timezone, created_at, updated_at
      FROM shifts_phase2;

      CREATE TABLE break_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        start_at TEXT NOT NULL,
        end_at TEXT,
        is_paid INTEGER NOT NULL CHECK (is_paid IN (0, 1)),
        source TEXT NOT NULL CHECK (source IN ('tracked', 'manual')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (end_at IS NULL OR julianday(end_at) > julianday(start_at))
      );
      INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at)
      SELECT id, shift_id, start_at, end_at, is_paid, source, NULL, created_at, updated_at FROM break_sessions_phase2;

      CREATE TABLE recurrence_exceptions (
        id TEXT PRIMARY KEY NOT NULL,
        series_id TEXT NOT NULL REFERENCES recurrence_series(id) ON DELETE CASCADE,
        local_date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('deleted', 'modified')),
        shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE(series_id, local_date)
      );
      INSERT INTO recurrence_exceptions (id, series_id, local_date, type, shift_id, created_at)
      SELECT id, series_id, local_date, type, shift_id, created_at FROM recurrence_exceptions_phase2;

      DROP TABLE recurrence_exceptions_phase2;
      DROP TABLE break_sessions_phase2;
      DROP TABLE shifts_phase2;
      PRAGMA legacy_alter_table = OFF;

      CREATE UNIQUE INDEX one_active_shift ON shifts(status) WHERE status = 'active';
      CREATE UNIQUE INDEX one_active_break ON break_sessions((1)) WHERE end_at IS NULL;
      CREATE INDEX shifts_effective_range ON shifts(COALESCE(scheduled_start, actual_start, payable_start), COALESCE(scheduled_end, actual_end, payable_end, actual_start));
      CREATE INDEX shifts_workplace ON shifts(workplace_id);
      CREATE INDEX shifts_recurrence_group ON shifts(recurrence_group_id);
      CREATE UNIQUE INDEX recurrence_occurrence_unique ON shifts(recurrence_group_id, recurrence_original_start) WHERE recurrence_group_id IS NOT NULL AND recurrence_original_start IS NOT NULL;
      CREATE INDEX break_sessions_shift ON break_sessions(shift_id, start_at);

      CREATE TRIGGER prevent_open_break_for_inactive_shift
      BEFORE INSERT ON break_sessions
      WHEN NEW.end_at IS NULL AND NOT EXISTS (SELECT 1 FROM shifts WHERE id = NEW.shift_id AND status = 'active')
      BEGIN SELECT RAISE(ABORT, 'open break requires active shift'); END;

      CREATE TRIGGER prevent_reopening_break_for_inactive_shift
      BEFORE UPDATE OF end_at ON break_sessions
      WHEN NEW.end_at IS NULL AND NOT EXISTS (SELECT 1 FROM shifts WHERE id = NEW.shift_id AND status = 'active')
      BEGIN SELECT RAISE(ABORT, 'open break requires active shift'); END;

      CREATE TRIGGER prevent_shift_closing_with_open_break
      BEFORE UPDATE OF status ON shifts
      WHEN OLD.status = 'active' AND NEW.status != 'active' AND EXISTS (SELECT 1 FROM break_sessions WHERE shift_id = OLD.id AND end_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'active break must be resolved first'); END;
    `,
  },
  {
    version: 4,
    name: 'salary_engine',
    sql: `
      ALTER TABLE salary_profiles ADD COLUMN workplace_id TEXT REFERENCES workplaces(id) ON DELETE CASCADE;
      ALTER TABLE salary_profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem';
      ALTER TABLE salary_profiles ADD COLUMN default_travel_reimbursement_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_travel_reimbursement_minor >= 0);
      ALTER TABLE salary_profiles ADD COLUMN default_shift_bonus_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_shift_bonus_minor >= 0);
      ALTER TABLE salary_profiles ADD COLUMN calculation_rounding_mode TEXT NOT NULL DEFAULT 'half_up' CHECK (calculation_rounding_mode IN ('half_up', 'floor', 'ceiling'));
      ALTER TABLE salary_profiles ADD COLUMN effective_from TEXT;
      ALTER TABLE salary_profiles ADD COLUMN effective_to TEXT;
      ALTER TABLE salary_profiles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
      ALTER TABLE salary_profiles ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1));
      UPDATE salary_profiles SET workplace_id = (
        SELECT workplaces.id FROM workplaces WHERE workplaces.salary_profile_id = salary_profiles.id ORDER BY workplaces.id LIMIT 1
      ) WHERE workplace_id IS NULL;
      UPDATE salary_profiles SET workplace_id = (
        SELECT shifts.workplace_id FROM shifts WHERE shifts.salary_profile_id = salary_profiles.id ORDER BY shifts.created_at, shifts.id LIMIT 1
      ) WHERE workplace_id IS NULL;

      ALTER TABLE workplaces ADD COLUMN default_travel_reimbursement_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_travel_reimbursement_minor >= 0);
      ALTER TABLE workplaces ADD COLUMN default_shift_bonus_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_shift_bonus_minor >= 0);
      ALTER TABLE workplaces ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1));
      ALTER TABLE roles ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1));
      ALTER TABLE pay_rules ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1));

      CREATE TEMP TABLE legacy_profile_workplace_links AS
      SELECT salary_profile_id AS profile_id, id AS workplace_id FROM workplaces WHERE salary_profile_id IS NOT NULL
      UNION
      SELECT salary_profile_id, workplace_id FROM shifts WHERE salary_profile_id IS NOT NULL
      UNION
      SELECT salary_profile_id, workplace_id FROM shift_templates WHERE salary_profile_id IS NOT NULL AND workplace_id IS NOT NULL;

      INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
        default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, effective_from, effective_to,
        is_active, is_archived, created_at, updated_at)
      SELECT profile.id || '__wp__' || links.workplace_id, links.workplace_id, profile.name, profile.currency,
        profile.standard_hourly_rate_minor, profile.break_policy, profile.timezone, profile.default_travel_reimbursement_minor,
        profile.default_shift_bonus_minor, profile.calculation_rounding_mode, profile.effective_from, profile.effective_to,
        profile.is_active, profile.is_archived, profile.created_at, profile.updated_at
      FROM legacy_profile_workplace_links links
      JOIN salary_profiles profile ON profile.id = links.profile_id
      WHERE links.workplace_id != profile.workplace_id;

      INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, is_enabled,
        effective_from, effective_to, created_at, updated_at)
      SELECT rule.id || '__wp__' || links.workplace_id, rule.salary_profile_id || '__wp__' || links.workplace_id,
        rule.name, rule.priority, rule.conditions_json, rule.effect_json, rule.can_stack, rule.is_enabled,
        rule.effective_from, rule.effective_to, rule.created_at, rule.updated_at
      FROM legacy_profile_workplace_links links
      JOIN salary_profiles original ON original.id = links.profile_id
      JOIN pay_rules rule ON rule.salary_profile_id = links.profile_id
      WHERE links.workplace_id != original.workplace_id AND original.id NOT LIKE '%__wp__%';

      UPDATE workplaces SET salary_profile_id = salary_profile_id || '__wp__' || id
      WHERE salary_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM salary_profiles profile WHERE profile.id = workplaces.salary_profile_id AND profile.workplace_id != workplaces.id
      );
      UPDATE shifts SET salary_profile_id = salary_profile_id || '__wp__' || workplace_id
      WHERE salary_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM salary_profiles profile WHERE profile.id = shifts.salary_profile_id AND profile.workplace_id != shifts.workplace_id
      );
      UPDATE shift_templates SET salary_profile_id = salary_profile_id || '__wp__' || workplace_id
      WHERE salary_profile_id IS NOT NULL AND workplace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM salary_profiles profile WHERE profile.id = shift_templates.salary_profile_id AND profile.workplace_id != shift_templates.workplace_id
      );
      DROP TABLE legacy_profile_workplace_links;

      ALTER TABLE shifts ADD COLUMN hourly_rate_override_minor INTEGER CHECK (hourly_rate_override_minor >= 0);
      ALTER TABLE shifts ADD COLUMN fixed_bonus_override_minor INTEGER CHECK (fixed_bonus_override_minor >= 0);
      ALTER TABLE shifts ADD COLUMN travel_reimbursement_override_minor INTEGER CHECK (travel_reimbursement_override_minor >= 0);
      ALTER TABLE shifts ADD COLUMN salary_calculation_status TEXT NOT NULL DEFAULT 'not_calculated'
        CHECK (salary_calculation_status IN ('not_calculated', 'estimated', 'finalized', 'incomplete', 'stale'));

      CREATE TABLE salary_calculation_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version > 0),
        status TEXT NOT NULL CHECK (status IN ('estimated', 'finalized', 'incomplete')),
        context TEXT NOT NULL CHECK (context IN ('scheduled', 'completed', 'active_provisional')),
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE SET NULL,
        resolved_rate_minor INTEGER CHECK (resolved_rate_minor > 0),
        payable_minutes INTEGER NOT NULL CHECK (payable_minutes >= 0),
        regular_minutes INTEGER NOT NULL CHECK (regular_minutes >= 0),
        special_rate_minutes INTEGER NOT NULL CHECK (special_rate_minutes >= 0),
        base_pay_minor INTEGER NOT NULL CHECK (base_pay_minor >= 0),
        premium_pay_minor INTEGER NOT NULL CHECK (premium_pay_minor >= 0),
        fixed_bonuses_minor INTEGER NOT NULL CHECK (fixed_bonuses_minor >= 0),
        reimbursements_minor INTEGER NOT NULL CHECK (reimbursements_minor >= 0),
        total_gross_pay_minor INTEGER CHECK (total_gross_pay_minor >= 0),
        result_json TEXT NOT NULL CHECK (json_valid(result_json)),
        engine_version TEXT NOT NULL,
        calculated_at TEXT NOT NULL,
        is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
        created_at TEXT NOT NULL,
        UNIQUE(shift_id, version)
      );
      CREATE UNIQUE INDEX one_current_salary_snapshot ON salary_calculation_snapshots(shift_id) WHERE is_current = 1;
      CREATE INDEX salary_snapshots_shift_history ON salary_calculation_snapshots(shift_id, version DESC);
      CREATE INDEX salary_profiles_effective ON salary_profiles(workplace_id, is_active, effective_from, effective_to);
      CREATE INDEX pay_rules_profile_priority ON pay_rules(salary_profile_id, is_enabled, priority DESC, id);
      CREATE INDEX shifts_salary_status ON shifts(salary_calculation_status, status);

      CREATE TRIGGER mark_salary_calculation_stale
      AFTER UPDATE OF workplace_id, role_id, salary_profile_id, status, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, payable_break_minutes,
        hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor ON shifts
      WHEN OLD.salary_calculation_status = 'finalized'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale' WHERE id = NEW.id;
      END;

      CREATE TRIGGER mark_later_daily_salary_dependencies_stale
      AFTER UPDATE OF workplace_id, role_id, salary_profile_id, status, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, payable_break_minutes,
        hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor ON shifts
      WHEN OLD.status = 'completed'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id != NEW.id AND status = 'completed' AND salary_calculation_status = 'finalized'
          AND julianday(payable_start) >= MIN(julianday(COALESCE(OLD.payable_start, OLD.actual_start, OLD.scheduled_start)), julianday(COALESCE(NEW.payable_start, NEW.actual_start, NEW.scheduled_start)))
          AND julianday(payable_start) < MAX(julianday(COALESCE(OLD.payable_end, OLD.actual_end, OLD.scheduled_end)), julianday(COALESCE(NEW.payable_end, NEW.actual_end, NEW.scheduled_end))) + (27.0 / 24.0);
      END;

      CREATE TRIGGER mark_salary_stale_after_break_insert
      AFTER INSERT ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale' WHERE id = NEW.shift_id AND salary_calculation_status = 'finalized';
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id != NEW.shift_id AND status = 'completed' AND salary_calculation_status = 'finalized'
          AND julianday(payable_start) >= (SELECT julianday(COALESCE(payable_start, actual_start, scheduled_start)) FROM shifts WHERE id = NEW.shift_id)
          AND julianday(payable_start) < (SELECT julianday(COALESCE(payable_end, actual_end, scheduled_end)) + (27.0 / 24.0) FROM shifts WHERE id = NEW.shift_id);
      END;
      CREATE TRIGGER mark_salary_stale_after_break_update
      AFTER UPDATE OF start_at, end_at, is_paid, shift_id ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale' WHERE id IN (OLD.shift_id, NEW.shift_id) AND salary_calculation_status = 'finalized';
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id NOT IN (OLD.shift_id, NEW.shift_id) AND status = 'completed' AND salary_calculation_status = 'finalized'
          AND julianday(payable_start) >= (SELECT julianday(COALESCE(payable_start, actual_start, scheduled_start)) FROM shifts WHERE id = NEW.shift_id)
          AND julianday(payable_start) < (SELECT julianday(COALESCE(payable_end, actual_end, scheduled_end)) + (27.0 / 24.0) FROM shifts WHERE id = NEW.shift_id);
      END;
      CREATE TRIGGER mark_salary_stale_after_break_delete
      AFTER DELETE ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale' WHERE id = OLD.shift_id AND salary_calculation_status = 'finalized';
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id != OLD.shift_id AND status = 'completed' AND salary_calculation_status = 'finalized'
          AND julianday(payable_start) >= (SELECT julianday(COALESCE(payable_start, actual_start, scheduled_start)) FROM shifts WHERE id = OLD.shift_id)
          AND julianday(payable_start) < (SELECT julianday(COALESCE(payable_end, actual_end, scheduled_end)) + (27.0 / 24.0) FROM shifts WHERE id = OLD.shift_id);
      END;
    `,
  },
  {
    version: 5,
    name: 'smart_assistance',
    sql: `
      -- Extend shift_templates with Phase 5 fields
      ALTER TABLE shift_templates ADD COLUMN valid_weekdays TEXT;
      ALTER TABLE shift_templates ADD COLUMN expected_break_type TEXT CHECK (expected_break_type IN ('paid', 'unpaid'));
      ALTER TABLE shift_templates ADD COLUMN color_token TEXT;
      ALTER TABLE shift_templates ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1));
      ALTER TABLE shift_templates ADD COLUMN expected_duration_minutes INTEGER CHECK (expected_duration_minutes > 0);

      CREATE INDEX shift_templates_active ON shift_templates(is_archived, name COLLATE NOCASE);

      CREATE TABLE prediction_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        feedback_type TEXT NOT NULL CHECK (feedback_type IN ('accepted_all', 'accepted_partial', 'rejected', 'edited_after_acceptance')),
        engine_version TEXT NOT NULL,
        candidate_source TEXT NOT NULL CHECK (candidate_source IN ('nearby_scheduled_shift', 'template', 'historical_pattern')),
        candidate_source_id TEXT NOT NULL,
        score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
        accepted_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(accepted_fields_json)),
        rejected_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(rejected_fields_json)),
        created_at TEXT NOT NULL
      );

      CREATE INDEX prediction_feedback_source ON prediction_feedback(candidate_source, candidate_source_id, created_at DESC);
      CREATE INDEX prediction_feedback_recent ON prediction_feedback(created_at DESC);

      CREATE TABLE workplace_notification_overrides (
        workplace_id TEXT PRIMARY KEY NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
        scheduled_shift_reminders INTEGER CHECK (scheduled_shift_reminders IN (0, 1)),
        shift_reminder_offsets_json TEXT CHECK (shift_reminder_offsets_json IS NULL OR json_valid(shift_reminder_offsets_json)),
        missed_clock_in_reminders INTEGER CHECK (missed_clock_in_reminders IN (0, 1)),
        missed_clock_in_grace_minutes INTEGER CHECK (missed_clock_in_grace_minutes >= 0 AND missed_clock_in_grace_minutes <= 120),
        expected_end_reminders INTEGER CHECK (expected_end_reminders IN (0, 1)),
        overdue_shift_reminders INTEGER CHECK (overdue_shift_reminders IN (0, 1)),
        long_break_reminders INTEGER CHECK (long_break_reminders IN (0, 1)),
        long_unpaid_break_threshold_minutes INTEGER CHECK (long_unpaid_break_threshold_minutes >= 0 AND long_unpaid_break_threshold_minutes <= 240),
        long_paid_break_threshold_minutes INTEGER CHECK (long_paid_break_threshold_minutes >= 0 AND long_paid_break_threshold_minutes <= 240),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE scheduled_notification_records (
        logical_key TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('shift_reminder', 'missed_clock_in', 'expected_end_soon', 'expected_end', 'overdue_shift', 'long_break', 'daily_summary')),
        scheduled_for TEXT NOT NULL,
        shift_id TEXT REFERENCES shifts(id) ON DELETE CASCADE,
        break_session_id TEXT REFERENCES break_sessions(id) ON DELETE CASCADE,
        workplace_id TEXT REFERENCES workplaces(id) ON DELETE CASCADE,
        title_key TEXT NOT NULL,
        body_key TEXT NOT NULL,
        body_params_json TEXT CHECK (body_params_json IS NULL OR json_valid(body_params_json)),
        native_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX scheduled_notifications_shift ON scheduled_notification_records(shift_id) WHERE shift_id IS NOT NULL;
      CREATE INDEX scheduled_notifications_scheduled_for ON scheduled_notification_records(scheduled_for);
    `,
  },
  {
    version: 6,
    name: 'exports_and_onboarding',
    sql: `
      CREATE TABLE export_presets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'ics', 'backup')),
        config_json TEXT NOT NULL CHECK (json_valid(config_json)),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE export_history (
        id TEXT PRIMARY KEY NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'ics', 'backup')),
        preset_id TEXT REFERENCES export_presets(id) ON DELETE SET NULL,
        reporting_period TEXT,
        workplace_filter TEXT,
        generated_at TEXT NOT NULL,
        sanitized_filename TEXT,
        status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
        created_at TEXT NOT NULL
      );

      CREATE INDEX export_history_recent ON export_history(created_at DESC);
      CREATE INDEX export_presets_active ON export_presets(is_archived, name COLLATE NOCASE);

      -- Seed onboarding setting for existing users who already have data
      INSERT INTO app_settings (key, value_json, updated_at)
      SELECT 'onboarding_completed', 'true', datetime('now')
      WHERE EXISTS (SELECT 1 FROM workplaces LIMIT 1) OR EXISTS (SELECT 1 FROM shifts LIMIT 1)
      ON CONFLICT(key) DO NOTHING;
    `,
  },
  {
    version: 7,
    name: 'shift_type_pay_multipliers',
    sql: `
      -- Existing shift templates become the canonical predefined shift types.
      -- Neutral defaults preserve all previously stored compensation behavior.
      ALTER TABLE shift_templates ADD COLUMN pay_multiplier_basis_points INTEGER NOT NULL DEFAULT 10000
        CHECK (pay_multiplier_basis_points >= 10000 AND pay_multiplier_basis_points <= 100000);

      -- Shifts snapshot the human label and multiplier so type edits/deletes never rewrite history.
      ALTER TABLE shifts ADD COLUMN shift_type_name_snapshot TEXT;
      ALTER TABLE shifts ADD COLUMN shift_type_pay_multiplier_basis_points INTEGER NOT NULL DEFAULT 10000
        CHECK (shift_type_pay_multiplier_basis_points >= 10000 AND shift_type_pay_multiplier_basis_points <= 100000);

      UPDATE shifts
      SET shift_type_name_snapshot = (
        SELECT name FROM shift_templates WHERE shift_templates.id = shifts.shift_template_id
      )
      WHERE shift_template_id IS NOT NULL;

      UPDATE recurrence_series
      SET template_json = json_set(
        template_json,
        '$.shiftTypeNameSnapshot', (
          SELECT name FROM shift_templates
          WHERE shift_templates.id = json_extract(recurrence_series.template_json, '$.shiftTemplateId')
        ),
        '$.shiftTypePayMultiplierBasisPoints', 10000
      )
      WHERE json_extract(template_json, '$.shiftTemplateId') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM shift_templates
          WHERE shift_templates.id = json_extract(recurrence_series.template_json, '$.shiftTemplateId')
        );

      -- Selecting/changing a type on a completed shift is salary-sensitive.
      DROP TRIGGER mark_salary_calculation_stale;
      CREATE TRIGGER mark_salary_calculation_stale
      AFTER UPDATE OF workplace_id, role_id, salary_profile_id, status, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, payable_break_minutes,
        hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor,
        shift_type_pay_multiplier_basis_points ON shifts
      WHEN OLD.salary_calculation_status = 'finalized'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale' WHERE id = NEW.id;
      END;

      DROP TRIGGER mark_later_daily_salary_dependencies_stale;
      CREATE TRIGGER mark_later_daily_salary_dependencies_stale
      AFTER UPDATE OF workplace_id, role_id, salary_profile_id, status, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, payable_break_minutes,
        hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor,
        shift_type_pay_multiplier_basis_points ON shifts
      WHEN OLD.status = 'completed'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id != NEW.id AND status = 'completed' AND salary_calculation_status = 'finalized'
          AND julianday(payable_start) >= MIN(julianday(COALESCE(OLD.payable_start, OLD.actual_start, OLD.scheduled_start)), julianday(COALESCE(NEW.payable_start, NEW.actual_start, NEW.scheduled_start)))
          AND julianday(payable_start) < MAX(julianday(COALESCE(OLD.payable_end, OLD.actual_end, OLD.scheduled_end)), julianday(COALESCE(NEW.payable_end, NEW.actual_end, NEW.scheduled_end))) + (27.0 / 24.0);
      END;
    `,
  },
  {
    version: 8,
    name: 'workweek_aware_salary',
    sql: `
      -- Sunday is the Hebrew-first display default, but weekly overtime remains
      -- disabled so upgrading cannot change any existing calculation.
      ALTER TABLE salary_profiles ADD COLUMN workweek_start_weekday INTEGER NOT NULL DEFAULT 0
        CHECK (workweek_start_weekday >= 0 AND workweek_start_weekday <= 6);
      ALTER TABLE salary_profiles ADD COLUMN weekly_overtime_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (weekly_overtime_enabled IN (0, 1));
      ALTER TABLE salary_profiles ADD COLUMN weekly_regular_minutes INTEGER
        CHECK (weekly_regular_minutes IS NULL OR weekly_regular_minutes > 0);
      ALTER TABLE salary_profiles ADD COLUMN weekly_overtime_multiplier_basis_points INTEGER
        CHECK (weekly_overtime_multiplier_basis_points IS NULL OR weekly_overtime_multiplier_basis_points >= 10000);
      ALTER TABLE salary_profiles ADD COLUMN weekly_overtime_basis TEXT NOT NULL DEFAULT 'net'
        CHECK (weekly_overtime_basis IN ('net', 'gross'))
        CHECK (
          weekly_overtime_enabled = 0 OR
          (weekly_regular_minutes IS NOT NULL AND weekly_overtime_multiplier_basis_points IS NOT NULL)
        );

      -- Daily dependency invalidation from the salary-engine migration remains
      -- independent. Weekly dependencies use engine-authored local-week keys from
      -- the frozen JSON, which is exact across timezones and overnight boundaries.
      CREATE TRIGGER mark_later_weekly_salary_dependencies_stale
      AFTER UPDATE OF workplace_id, role_id, salary_profile_id, status, scheduled_start, scheduled_end,
        actual_start, actual_end, payable_start, payable_end, payable_break_minutes,
        hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor,
        shift_type_pay_multiplier_basis_points ON shifts
      WHEN OLD.status = 'completed'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM salary_calculation_snapshots target_snapshot
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = OLD.workplace_id
           AND dependency_shift.id != OLD.id
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = target_snapshot.salary_profile_id
          WHERE target_snapshot.shift_id = OLD.id
            AND target_snapshot.is_current = 1
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(OLD.payable_start, OLD.actual_start, OLD.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(target_snapshot.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;

      -- A newly persisted current snapshot is the authoritative point at which a
      -- completed shift acquires (or changes) its destination weekly cohort. This
      -- covers historical inserts, scheduled-to-completed transitions, and moves
      -- across workplace/profile/workweek boundaries after recalculation.
      CREATE TRIGGER mark_later_weekly_salary_dependencies_stale_after_snapshot_insert
      AFTER INSERT ON salary_calculation_snapshots
      WHEN NEW.is_current = 1 AND NEW.status IN ('finalized', 'incomplete')
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM shifts target_shift
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = target_shift.workplace_id
           AND dependency_shift.id != target_shift.id
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = NEW.salary_profile_id
          WHERE target_shift.id = NEW.shift_id
            AND target_shift.status = 'completed'
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(target_shift.payable_start, target_shift.actual_start, target_shift.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(NEW.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;

      CREATE TRIGGER mark_later_salary_dependencies_stale_before_delete
      BEFORE DELETE ON shifts
      WHEN OLD.status = 'completed'
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM salary_calculation_snapshots target_snapshot
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = OLD.workplace_id
           AND dependency_shift.id != OLD.id
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = target_snapshot.salary_profile_id
          WHERE target_snapshot.shift_id = OLD.id
            AND target_snapshot.is_current = 1
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(OLD.payable_start, OLD.actual_start, OLD.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(target_snapshot.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;

      CREATE TRIGGER mark_weekly_salary_stale_after_break_insert
      AFTER INSERT ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM shifts target_shift
          JOIN salary_calculation_snapshots target_snapshot
            ON target_snapshot.shift_id = target_shift.id AND target_snapshot.is_current = 1
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = target_shift.workplace_id
           AND dependency_shift.id != target_shift.id
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = target_snapshot.salary_profile_id
          WHERE target_shift.id = NEW.shift_id
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(target_shift.payable_start, target_shift.actual_start, target_shift.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(target_snapshot.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;

      CREATE TRIGGER mark_weekly_salary_stale_after_break_update
      AFTER UPDATE OF start_at, end_at, is_paid, shift_id ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM shifts target_shift
          JOIN salary_calculation_snapshots target_snapshot
            ON target_snapshot.shift_id = target_shift.id AND target_snapshot.is_current = 1
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = target_shift.workplace_id
           AND dependency_shift.id NOT IN (OLD.shift_id, NEW.shift_id)
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = target_snapshot.salary_profile_id
          WHERE target_shift.id IN (OLD.shift_id, NEW.shift_id)
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(target_shift.payable_start, target_shift.actual_start, target_shift.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(target_snapshot.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;

      CREATE TRIGGER mark_weekly_salary_stale_after_break_delete
      AFTER DELETE ON break_sessions
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE id IN (
          SELECT dependency_shift.id
          FROM shifts target_shift
          JOIN salary_calculation_snapshots target_snapshot
            ON target_snapshot.shift_id = target_shift.id AND target_snapshot.is_current = 1
          JOIN shifts dependency_shift
            ON dependency_shift.workplace_id = target_shift.workplace_id
           AND dependency_shift.id != target_shift.id
           AND dependency_shift.status = 'completed'
           AND dependency_shift.salary_calculation_status = 'finalized'
          JOIN salary_calculation_snapshots dependency_snapshot
            ON dependency_snapshot.shift_id = dependency_shift.id
           AND dependency_snapshot.is_current = 1
           AND dependency_snapshot.status = 'finalized'
           AND dependency_snapshot.salary_profile_id = target_snapshot.salary_profile_id
          WHERE target_shift.id = OLD.shift_id
            AND EXISTS (
              SELECT 1 FROM json_each(dependency_snapshot.result_json, '$.explanations') weekly_explanation
              WHERE weekly_explanation.value LIKE 'salary.explanations.weekly_overtime:%'
                 OR weekly_explanation.value = 'salary.explanations.configured_weekly_overtime'
            )
            AND julianday(COALESCE(dependency_shift.payable_start, dependency_shift.actual_start, dependency_shift.scheduled_start))
              > julianday(COALESCE(target_shift.payable_start, target_shift.actual_start, target_shift.scheduled_start))
            AND EXISTS (
              SELECT 1
              FROM json_each(target_snapshot.result_json, '$.workweekAllocations') target_week
              JOIN json_each(dependency_snapshot.result_json, '$.workweekAllocations') dependency_week
                ON json_extract(dependency_week.value, '$.startLocalDate') = json_extract(target_week.value, '$.startLocalDate')
            )
        );
      END;
    `,
  },
  {
    version: 9,
    name: 'evidence_aware_holiday_rest',
    sql: `
      -- Premium families make multiplier interaction explicit. Existing
      -- worked-minute rules retain the overtime-family behavior introduced in
      -- Migration 8; every other legacy rule keeps its ordinary behavior.
      ALTER TABLE pay_rules ADD COLUMN premium_family TEXT
        CHECK (premium_family IS NULL OR premium_family IN ('ordinary', 'overtime', 'special_interval'));

      CREATE TABLE calendar_evidence_intervals (
        id TEXT PRIMARY KEY NOT NULL,
        schedule_id TEXT REFERENCES weekly_rest_schedules(id) ON DELETE SET NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
        salary_profile_id TEXT REFERENCES salary_profiles(id) ON DELETE CASCADE,
        interval_type TEXT NOT NULL CHECK (interval_type IN ('holiday', 'weekly_rest', 'custom')),
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        start_at TEXT NOT NULL CHECK (julianday(start_at) IS NOT NULL),
        end_at TEXT NOT NULL CHECK (julianday(end_at) IS NOT NULL),
        timezone TEXT NOT NULL CHECK (length(timezone) BETWEEN 1 AND 120),
        source_kind TEXT NOT NULL CHECK (source_kind IN ('manual', 'confirmed_preset', 'imported')),
        source_title TEXT CHECK (source_title IS NULL OR length(source_title) <= 240),
        source_url TEXT CHECK (source_url IS NULL OR length(source_url) <= 2048),
        preset_id TEXT CHECK (preset_id IS NULL OR length(preset_id) <= 120),
        preset_version TEXT CHECK (preset_version IS NULL OR length(preset_version) <= 80),
        confirmed_at TEXT NOT NULL CHECK (julianday(confirmed_at) IS NOT NULL),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        archived_at TEXT CHECK (archived_at IS NULL OR julianday(archived_at) IS NOT NULL),
        created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
        updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
        CHECK (julianday(end_at) > julianday(start_at)),
        CHECK (schedule_id IS NULL OR interval_type = 'weekly_rest'),
        CHECK (source_kind != 'confirmed_preset' OR (preset_id IS NOT NULL AND preset_version IS NOT NULL)),
        CHECK (
          (is_archived = 0 AND archived_at IS NULL) OR
          (is_archived = 1 AND archived_at IS NOT NULL)
        )
      );

      CREATE TABLE weekly_rest_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        workplace_id TEXT NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
        salary_profile_id TEXT NOT NULL REFERENCES salary_profiles(id) ON DELETE CASCADE,
        label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
        start_weekday INTEGER NOT NULL CHECK (start_weekday BETWEEN 0 AND 6),
        start_time TEXT NOT NULL,
        end_weekday INTEGER NOT NULL CHECK (end_weekday BETWEEN 0 AND 6),
        end_time TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
        source_kind TEXT NOT NULL CHECK (source_kind IN ('manual', 'confirmed_preset', 'imported')),
        source_title TEXT CHECK (source_title IS NULL OR length(source_title) <= 240),
        source_url TEXT CHECK (source_url IS NULL OR length(source_url) <= 2048),
        preset_id TEXT CHECK (preset_id IS NULL OR length(preset_id) <= 120),
        preset_version TEXT CHECK (preset_version IS NULL OR length(preset_version) <= 80),
        confirmed_at TEXT CHECK (confirmed_at IS NULL OR julianday(confirmed_at) IS NOT NULL),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        archived_at TEXT CHECK (archived_at IS NULL OR julianday(archived_at) IS NOT NULL),
        created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
        updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
        CHECK (
          start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND
          CAST(substr(start_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23 AND
          CAST(substr(start_time, 4, 2) AS INTEGER) BETWEEN 0 AND 59
        ),
        CHECK (
          end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND
          CAST(substr(end_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23 AND
          CAST(substr(end_time, 4, 2) AS INTEGER) BETWEEN 0 AND 59
        ),
        CHECK (start_weekday != end_weekday OR start_time != end_time),
        CHECK (enabled = 0 OR confirmed_at IS NOT NULL),
        CHECK (source_kind != 'confirmed_preset' OR (preset_id IS NOT NULL AND preset_version IS NOT NULL)),
        CHECK (
          (is_archived = 0 AND archived_at IS NULL) OR
          (is_archived = 1 AND archived_at IS NOT NULL)
        ),
        UNIQUE(salary_profile_id)
      );

      CREATE INDEX evidence_intervals_workplace_range
        ON calendar_evidence_intervals(workplace_id, is_archived, julianday(start_at), julianday(end_at));
      CREATE INDEX evidence_intervals_profile_range
        ON calendar_evidence_intervals(salary_profile_id, is_archived, julianday(start_at), julianday(end_at))
        WHERE salary_profile_id IS NOT NULL;
      CREATE INDEX weekly_rest_schedules_workplace
        ON weekly_rest_schedules(workplace_id, is_archived, enabled, salary_profile_id);

      CREATE TRIGGER prevent_cross_workplace_evidence_profile_insert
      BEFORE INSERT ON calendar_evidence_intervals
      WHEN NEW.salary_profile_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM salary_profiles
        WHERE id = NEW.salary_profile_id AND workplace_id = NEW.workplace_id
      )
      BEGIN SELECT RAISE(ABORT, 'evidence interval profile must belong to its workplace'); END;

      -- Child-side guards above cover evidence/schedule edits. This parent-side
      -- guard prevents moving a salary profile while scoped children would be
      -- left associated with the old workplace.
      CREATE TRIGGER prevent_profile_move_stranding_evidence
      BEFORE UPDATE OF workplace_id ON salary_profiles
      WHEN NOT (OLD.workplace_id IS NEW.workplace_id) AND (
        EXISTS (
          SELECT 1 FROM calendar_evidence_intervals interval
          WHERE interval.salary_profile_id = OLD.id
            AND NOT (interval.workplace_id IS NEW.workplace_id)
        ) OR EXISTS (
          SELECT 1 FROM weekly_rest_schedules schedule
          WHERE schedule.salary_profile_id = OLD.id
            AND NOT (schedule.workplace_id IS NEW.workplace_id)
        )
      )
      BEGIN SELECT RAISE(ABORT, 'salary profile move would strand evidence configuration'); END;

      CREATE TRIGGER prevent_cross_workplace_weekly_rest_insert
      BEFORE INSERT ON weekly_rest_schedules
      WHEN NOT EXISTS (
        SELECT 1 FROM salary_profiles
        WHERE id = NEW.salary_profile_id AND workplace_id = NEW.workplace_id
      )
      BEGIN SELECT RAISE(ABORT, 'weekly-rest profile must belong to its workplace'); END;

      CREATE TRIGGER prevent_cross_workplace_weekly_rest_update
      BEFORE UPDATE OF workplace_id, salary_profile_id ON weekly_rest_schedules
      WHEN NOT EXISTS (
        SELECT 1 FROM salary_profiles
        WHERE id = NEW.salary_profile_id AND workplace_id = NEW.workplace_id
      )
      BEGIN SELECT RAISE(ABORT, 'weekly-rest profile must belong to its workplace'); END;

      CREATE TRIGGER prevent_cross_workplace_evidence_profile_update
      BEFORE UPDATE OF workplace_id, salary_profile_id ON calendar_evidence_intervals
      WHEN NEW.salary_profile_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM salary_profiles
        WHERE id = NEW.salary_profile_id AND workplace_id = NEW.workplace_id
      )
      BEGIN SELECT RAISE(ABORT, 'evidence interval profile must belong to its workplace'); END;

      CREATE TRIGGER prevent_mismatched_evidence_schedule_insert
      BEFORE INSERT ON calendar_evidence_intervals
      WHEN NEW.schedule_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM weekly_rest_schedules
        WHERE id = NEW.schedule_id
          AND workplace_id = NEW.workplace_id
          AND salary_profile_id IS NEW.salary_profile_id
      )
      BEGIN SELECT RAISE(ABORT, 'evidence interval schedule must match its workplace and profile'); END;

      CREATE TRIGGER prevent_mismatched_evidence_schedule_update
      BEFORE UPDATE OF schedule_id, workplace_id, salary_profile_id ON calendar_evidence_intervals
      WHEN NEW.schedule_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM weekly_rest_schedules
        WHERE id = NEW.schedule_id
          AND workplace_id = NEW.workplace_id
          AND salary_profile_id IS NEW.salary_profile_id
      )
      BEGIN SELECT RAISE(ABORT, 'evidence interval schedule must match its workplace and profile'); END;

      -- Evidence is part of the estimate disclosure even when no pay rule is
      -- connected, so an added interval precisely stales overlapping completed
      -- calculations without changing or deleting their frozen snapshots.
      CREATE TRIGGER mark_salary_stale_after_evidence_insert
      AFTER INSERT ON calendar_evidence_intervals
      WHEN NEW.is_archived = 0
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE status = 'completed' AND salary_calculation_status = 'finalized'
          AND workplace_id = NEW.workplace_id
          AND julianday(COALESCE(payable_start, actual_start, scheduled_start)) < julianday(NEW.end_at)
          AND julianday(COALESCE(payable_end, actual_end, scheduled_end)) > julianday(NEW.start_at)
          AND (
            NEW.salary_profile_id IS NULL OR EXISTS (
              SELECT 1 FROM salary_calculation_snapshots snapshot
              WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = NEW.salary_profile_id
            )
          );
      END;

      CREATE TRIGGER mark_salary_stale_after_evidence_update
      AFTER UPDATE OF workplace_id, salary_profile_id, interval_type, name, start_at, end_at,
        timezone, source_kind, source_title, source_url, preset_id, preset_version, confirmed_at,
        is_archived, archived_at ON calendar_evidence_intervals
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE status = 'completed' AND salary_calculation_status = 'finalized'
          AND (
            (
              OLD.is_archived = 0 AND workplace_id = OLD.workplace_id
              AND julianday(COALESCE(payable_start, actual_start, scheduled_start)) < julianday(OLD.end_at)
              AND julianday(COALESCE(payable_end, actual_end, scheduled_end)) > julianday(OLD.start_at)
              AND (
                OLD.salary_profile_id IS NULL OR EXISTS (
                  SELECT 1 FROM salary_calculation_snapshots snapshot
                  WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                    AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = OLD.salary_profile_id
                )
              )
            ) OR (
              NEW.is_archived = 0 AND workplace_id = NEW.workplace_id
              AND julianday(COALESCE(payable_start, actual_start, scheduled_start)) < julianday(NEW.end_at)
              AND julianday(COALESCE(payable_end, actual_end, scheduled_end)) > julianday(NEW.start_at)
              AND (
                NEW.salary_profile_id IS NULL OR EXISTS (
                  SELECT 1 FROM salary_calculation_snapshots snapshot
                  WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                    AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = NEW.salary_profile_id
                )
              )
            ) OR EXISTS (
              SELECT 1 FROM salary_calculation_snapshots snapshot
              JOIN json_each(snapshot.result_json, '$.specialIntervalEvaluations') evaluation
              WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                AND snapshot.status = 'finalized'
                AND json_extract(evaluation.value, '$.intervalId') = OLD.id
            )
          );
      END;

      CREATE TRIGGER mark_salary_stale_before_evidence_delete
      BEFORE DELETE ON calendar_evidence_intervals
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE status = 'completed' AND salary_calculation_status = 'finalized'
          AND (
            (
              OLD.is_archived = 0
              AND workplace_id = OLD.workplace_id
              AND julianday(COALESCE(payable_start, actual_start, scheduled_start)) < julianday(OLD.end_at)
              AND julianday(COALESCE(payable_end, actual_end, scheduled_end)) > julianday(OLD.start_at)
              AND (OLD.salary_profile_id IS NULL OR EXISTS (
                SELECT 1 FROM salary_calculation_snapshots snapshot
                WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                  AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = OLD.salary_profile_id
              ))
            ) OR EXISTS (
              SELECT 1 FROM salary_calculation_snapshots snapshot
              JOIN json_each(snapshot.result_json, '$.specialIntervalEvaluations') evaluation
              WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
                AND snapshot.status = 'finalized'
                AND json_extract(evaluation.value, '$.intervalId') = OLD.id
            )
          );
      END;

      -- New recurring occurrences are resolved in application code because
      -- SQLite has no IANA timezone/DST model. These defensive triggers still
      -- invalidate every finalized calculation that froze the old schedule.
      CREATE TRIGGER mark_salary_stale_after_weekly_rest_update
      AFTER UPDATE OF workplace_id, salary_profile_id, label, start_weekday, start_time,
        end_weekday, end_time, enabled, confirmed_at, source_kind, source_title, source_url,
        preset_id, preset_version, is_archived, archived_at ON weekly_rest_schedules
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE status = 'completed' AND salary_calculation_status = 'finalized'
          AND EXISTS (
            SELECT 1 FROM salary_calculation_snapshots snapshot
            JOIN json_each(snapshot.result_json, '$.specialIntervalEvaluations') evaluation
            WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
              AND snapshot.status = 'finalized'
              AND json_extract(evaluation.value, '$.scheduleId') = OLD.id
          );
      END;

      CREATE TRIGGER mark_salary_stale_before_weekly_rest_delete
      BEFORE DELETE ON weekly_rest_schedules
      BEGIN
        UPDATE shifts SET salary_calculation_status = 'stale'
        WHERE status = 'completed' AND salary_calculation_status = 'finalized'
          AND EXISTS (
            SELECT 1 FROM salary_calculation_snapshots snapshot
            JOIN json_each(snapshot.result_json, '$.specialIntervalEvaluations') evaluation
            WHERE snapshot.shift_id = shifts.id AND snapshot.is_current = 1
              AND snapshot.status = 'finalized'
              AND json_extract(evaluation.value, '$.scheduleId') = OLD.id
          );
      END;
    `,
  },
];
