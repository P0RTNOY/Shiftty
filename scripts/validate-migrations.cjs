/* global __dirname */
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, '..', 'src', 'data', 'database', 'migrations.ts'), 'utf8');
const migrations = [...source.matchAll(/version:\s*(\d+),\s*name:\s*'([^']+)',\s*sql:\s*`([\s\S]*?)`/g)]
  .map((match) => ({ version: Number(match[1]), name: match[2], sql: match[3] }));
if (migrations.length !== 4) throw new Error(`Expected four migrations, found ${migrations.length}.`);

const directory = mkdtempSync(join(tmpdir(), 'shifty-migrations-'));
try {
  for (const startingVersion of [0, 1, 2, 3]) validateUpgrade(startingVersion);
  process.stdout.write('Migration 4 smoke tests passed for empty, v1, v2, and v3 databases.\n');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function sqlite(database, sql) {
  return execFileSync('sqlite3', ['-batch', database], { input: sql, encoding: 'utf8' }).trim();
}

function validateUpgrade(startingVersion) {
  const database = join(directory, `upgrade-${startingVersion}.sqlite`);
  sqlite(database, `PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);`);
  for (const migration of migrations.filter((item) => item.version <= startingVersion)) apply(database, migration);
  if (startingVersion > 0) seed(database, startingVersion);
  for (const migration of migrations.filter((item) => item.version > startingVersion)) apply(database, migration);

  const foreignKeys = sqlite(database, 'PRAGMA foreign_keys=ON; PRAGMA foreign_key_check;');
  if (foreignKeys) throw new Error(`Foreign-key failure upgrading v${startingVersion}: ${foreignKeys}`);
  const integrity = sqlite(database, 'PRAGMA integrity_check;');
  if (integrity !== 'ok') throw new Error(`Integrity failure upgrading v${startingVersion}: ${integrity}`);
  const snapshotTable = sqlite(database, "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='salary_calculation_snapshots';");
  if (snapshotTable !== '1') throw new Error(`Snapshot table missing after v${startingVersion} upgrade.`);
  if (startingVersion > 0) {
    const state = sqlite(database, "SELECT status || '|' || salary_calculation_status FROM shifts WHERE id='seed-shift';");
    if (state !== 'active|not_calculated') throw new Error(`Seed shift changed unexpectedly after v${startingVersion} upgrade: ${state}`);
    const openBreak = sqlite(database, "SELECT count(*) FROM break_sessions WHERE shift_id='seed-shift' AND end_at IS NULL;");
    if (openBreak !== '1') throw new Error(`Open break was not preserved from v${startingVersion}.`);
    const profileWorkplace = sqlite(database, "SELECT profile.workplace_id FROM shifts shift_record JOIN salary_profiles profile ON profile.id=shift_record.salary_profile_id WHERE shift_record.id='seed-shift';");
    if (profileWorkplace !== 'seed-workplace') throw new Error(`Shift-linked legacy profile was not associated after v${startingVersion}: ${profileWorkplace}`);
    const sharedProfileCount = sqlite(database, "SELECT count(DISTINCT workplace_id) FROM salary_profiles WHERE id='seed-profile' OR id LIKE 'seed-profile__wp__%';");
    if (sharedProfileCount !== '2') throw new Error(`Shared legacy profile was not cloned after v${startingVersion}: ${sharedProfileCount}`);
    const sharedRuleCount = sqlite(database, "SELECT count(*) FROM pay_rules WHERE id='seed-rule' OR id LIKE 'seed-rule__wp__%';");
    if (sharedRuleCount !== '2') throw new Error(`Shared legacy rules were not cloned after v${startingVersion}: ${sharedRuleCount}`);
    const orphanCount = sqlite(database, "SELECT count(*) FROM salary_profiles WHERE id='orphan-profile' AND workplace_id IS NULL;");
    if (orphanCount !== '1') throw new Error(`Unattached legacy profile was not preserved after v${startingVersion}.`);
    sqlite(database, `INSERT INTO shifts (id, workplace_id, scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end,
      expected_break_minutes, payable_break_minutes, status, hourly_rate_snapshot_minor, payable_source, completed_at,
      salary_calculation_status, timezone, created_at, updated_at)
      VALUES
      ('dependency-a', 'seed-workplace', '2026-07-02T08:00:00Z', '2026-07-02T12:00:00Z', '2026-07-02T08:00:00Z', '2026-07-02T12:00:00Z', '2026-07-02T08:00:00Z', '2026-07-02T12:00:00Z', 0, 0, 'completed', 5000, 'actual', '2026-07-02T12:00:00Z', 'finalized', 'Asia/Jerusalem', '2026-07-02T08:00:00Z', '2026-07-02T12:00:00Z'),
      ('dependency-b', 'seed-workplace', '2026-07-02T13:00:00Z', '2026-07-02T17:00:00Z', '2026-07-02T13:00:00Z', '2026-07-02T17:00:00Z', '2026-07-02T13:00:00Z', '2026-07-02T17:00:00Z', 0, 0, 'completed', 5000, 'actual', '2026-07-02T17:00:00Z', 'finalized', 'Asia/Jerusalem', '2026-07-02T13:00:00Z', '2026-07-02T17:00:00Z');
      UPDATE shifts SET payable_end='2026-07-02T10:00:00Z' WHERE id='dependency-a';`);
    const dependencyState = sqlite(database, "SELECT group_concat(salary_calculation_status, '|') FROM shifts WHERE id IN ('dependency-a', 'dependency-b') ORDER BY id;");
    if (dependencyState !== 'stale|stale') throw new Error(`Daily salary dependency was not invalidated after v${startingVersion}: ${dependencyState}`);
    sqlite(database, `UPDATE shifts SET salary_calculation_status='finalized' WHERE id IN ('dependency-a', 'dependency-b');
      INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at)
      VALUES ('dependency-break', 'dependency-a', '2026-07-02T09:00:00Z', '2026-07-02T09:15:00Z', 0, 'manual', NULL, '2026-07-02T12:00:00Z', '2026-07-02T12:00:00Z');`);
    const breakDependencyState = sqlite(database, "SELECT group_concat(salary_calculation_status, '|') FROM shifts WHERE id IN ('dependency-a', 'dependency-b') ORDER BY id;");
    if (breakDependencyState !== 'stale|stale') throw new Error(`Break salary dependency was not invalidated after v${startingVersion}: ${breakDependencyState}`);
  }
  if (startingVersion >= 2) {
    const recurrence = sqlite(database, "SELECT count(*) FROM recurrence_series WHERE id='seed-series';");
    if (recurrence !== '1') throw new Error(`Recurrence data was not preserved from v${startingVersion}.`);
  }
}

function apply(database, migration) {
  const name = migration.name.replaceAll("'", "''");
  sqlite(database, `PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; ${migration.sql}\nINSERT INTO schema_migrations VALUES (${migration.version}, '${name}', '2026-08-03T00:00:00Z'); COMMIT;`);
}

function seed(database, version) {
  const activeFields = version >= 3 ? ', active_origin' : '';
  const activeValues = version >= 3 ? ", 'scheduled'" : '';
  sqlite(database, `PRAGMA foreign_keys=ON;
    INSERT INTO salary_profiles (id, name, currency, standard_hourly_rate_minor, break_policy, created_at, updated_at)
    VALUES ('seed-profile', 'Legacy profile', 'ILS', 5000, 'unpaid', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
    INSERT INTO salary_profiles (id, name, currency, standard_hourly_rate_minor, break_policy, created_at, updated_at)
    VALUES ('orphan-profile', 'Unattached legacy profile', 'ILS', 4500, 'unpaid', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
    INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at)
    VALUES ('seed-workplace', 'Seed', 0, 0, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
    INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, salary_profile_id, created_at, updated_at)
    VALUES ('shared-workplace', 'Shared', 0, 0, 'seed-profile', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
    INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, created_at, updated_at)
    VALUES ('seed-rule', 'seed-profile', 'Legacy rule', 1, '[]', '{"type":"multiplier","basisPoints":12500}', 0, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');
    INSERT INTO shifts (id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, expected_break_minutes, status,
      hourly_rate_snapshot_minor, timezone, created_at, updated_at${activeFields})
    VALUES ('seed-shift', 'seed-workplace', 'seed-profile', '2026-07-01T08:00:00Z', '2026-07-01T16:00:00Z', '2026-07-01T08:00:00Z', 0,
      'active', 0, 'Asia/Jerusalem', '2026-07-01T08:00:00Z', '2026-07-01T08:00:00Z'${activeValues});
    INSERT INTO break_sessions (id, shift_id, start_at, is_paid, source, created_at, updated_at)
    VALUES ('seed-break', 'seed-shift', '2026-07-01T12:00:00Z', 0, 'tracked', '2026-07-01T12:00:00Z', '2026-07-01T12:00:00Z');
  `);
  if (version >= 2) sqlite(database, `INSERT INTO recurrence_series (id, rule_json, template_json, created_at, updated_at)
    VALUES ('seed-series', '{}', '{}', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');`);
}
