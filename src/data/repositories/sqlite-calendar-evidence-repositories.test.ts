import type * as SQLite from 'expo-sqlite';

import { initializeDatabase } from '@/data/database/database';
import {
  SqliteCalendarEvidenceIntervalRepository,
  SqliteWeeklyRestScheduleRepository,
} from '@/data/repositories/sqlite-calendar-evidence-repositories';
import { SqlitePayRuleRepository, SqliteSalaryProfileRepository } from '@/data/repositories/sqlite-salary-repositories';
import type { CalendarEvidenceInterval, WeeklyRestSchedule } from '@/domain/entities';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';
import { createPayRule, createSalaryProfile } from '@/test/fixtures';

const timestamp = '2026-08-24T00:00:00Z';

describe('SQLite calendar-evidence repositories', () => {
  let db: SQLite.SQLiteDatabase;
  let intervals: SqliteCalendarEvidenceIntervalRepository;
  let schedules: SqliteWeeklyRestScheduleRepository;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await initializeDatabase(db);
    intervals = new SqliteCalendarEvidenceIntervalRepository(db);
    schedules = new SqliteWeeklyRestScheduleRepository(db);
    await seedProfile(db, 'wp', 'profile');
  });

  afterEach(async () => { await db.closeAsync(); });

  it('round-trips source provenance and uses half-open, profile-aware overlap queries', async () => {
    const workplace = evidence({ id: 'workplace', salaryProfileId: undefined });
    const profile = evidence({ id: 'profile-only', salaryProfileId: 'profile', type: 'custom' });
    await intervals.save(workplace);
    await intervals.save(profile);

    await expect(intervals.listOverlapping({
      workplaceId: 'wp', salaryProfileId: 'profile',
      start: '2026-08-24T09:00:00Z', end: '2026-08-24T11:00:00Z',
    })).resolves.toEqual([profile, workplace]);
    await expect(intervals.listOverlapping({
      workplaceId: 'wp', salaryProfileId: 'profile',
      start: '2026-08-24T10:00:00Z', end: '2026-08-24T11:00:00Z',
    })).resolves.toEqual([]);

    await intervals.archive('profile-only', '2026-08-25T00:00:00Z');
    expect(await intervals.getById('profile-only')).toMatchObject({
      isArchived: true,
      archivedAt: '2026-08-25T00:00:00Z',
      sourceKind: 'confirmed_preset',
      presetId: 'fixture',
      presetVersion: '1',
    });
    await expect(intervals.listForScope({ workplaceId: 'wp', salaryProfileId: 'profile' }))
      .resolves.toEqual([workplace]);
  });

  it('round-trips an optional recurring schedule reference and clears it when the schedule is deleted', async () => {
    const recurringSchedule = schedule();
    await schedules.save(recurringSchedule);
    const occurrence = evidence({
      id: 'rest-occurrence',
      scheduleId: recurringSchedule.id,
      type: 'weekly_rest',
      name: 'Weekly-rest occurrence',
    });

    await intervals.save(occurrence);
    expect(await intervals.getById(occurrence.id)).toEqual(occurrence);

    await schedules.delete(recurringSchedule.id);
    expect(await intervals.getById(occurrence.id)).toEqual({ ...occurrence, scheduleId: undefined });
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('keeps a disabled schedule neutral and targets staleness when it becomes enabled', async () => {
    await seedFinalizedShift(
      db,
      'inside',
      'profile',
      '2026-08-28T16:00:00Z',
      '2026-08-28T20:00:00Z',
      {},
    );
    const disabled = schedule({ enabled: false, confirmedAt: undefined });
    await schedules.save(disabled);
    expect(await shiftStatus(db, 'inside')).toBe('finalized');

    const enabled = schedule({ enabled: true, confirmedAt: timestamp, updatedAt: '2026-08-25T00:00:00Z' });
    await schedules.save(enabled);

    expect(await shiftStatus(db, 'inside')).toBe('stale');
    expect(await schedules.getForProfile('profile')).toEqual(enabled);
  });

  it('uses frozen schedule provenance when disabling and deleting a live schedule', async () => {
    const enabled = schedule({ enabled: true, confirmedAt: timestamp });
    await schedules.save(enabled);
    await seedFinalizedShift(
      db,
      'historical',
      'profile',
      '2026-08-24T08:00:00Z',
      '2026-08-24T09:00:00Z',
      { specialIntervalEvaluations: [{ scheduleId: enabled.id }] },
    );

    await schedules.save({ ...enabled, enabled: false, updatedAt: '2026-08-25T00:00:00Z' });
    expect(await shiftStatus(db, 'historical')).toBe('stale');

    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized' WHERE id='historical'");
    await schedules.delete(enabled.id);
    expect(await shiftStatus(db, 'historical')).toBe('stale');
    expect(await schedules.getById(enabled.id)).toBeNull();
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('stales shifts in both old and new recurring-rest ranges when schedule boundaries change', async () => {
    const previous = schedule({ enabled: true, confirmedAt: timestamp });
    await schedules.save(previous);
    await seedFinalizedShift(db, 'old-range', 'profile', '2026-08-28T16:00:00Z', '2026-08-28T17:00:00Z', {});
    await seedFinalizedShift(db, 'new-range', 'profile', '2026-08-27T16:00:00Z', '2026-08-27T17:00:00Z', {});
    await seedFinalizedShift(db, 'unrelated-range', 'profile', '2026-08-30T08:00:00Z', '2026-08-30T09:00:00Z', {});
    const snapshotsBefore = await db.getAllAsync<{ id: string; result_json: string }>(
      'SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id',
    );

    await schedules.save({
      ...previous,
      startWeekday: 4,
      endWeekday: 5,
      updatedAt: '2026-08-25T00:00:00Z',
    });

    expect(await shiftStatus(db, 'old-range')).toBe('stale');
    expect(await shiftStatus(db, 'new-range')).toBe('stale');
    expect(await shiftStatus(db, 'unrelated-range')).toBe('finalized');
    expect(await db.getAllAsync('SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id'))
      .toEqual(snapshotsBefore);
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('invalidates an exact evidence overlap when a special-interval pay rule is added', async () => {
    await seedFinalizedShift(
      db,
      'rule-target',
      'profile',
      '2026-08-24T08:00:00Z',
      '2026-08-24T09:00:00Z',
      {},
    );
    await intervals.save(evidence({
      id: 'rule-evidence',
      start: '2026-08-24T08:30:00Z',
      end: '2026-08-24T09:30:00Z',
    }));
    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized' WHERE id='rule-target'");

    await new SqlitePayRuleRepository(db).save(createPayRule({
      id: 'special-rule',
      salaryProfileId: 'profile',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      premiumFamily: 'special_interval',
      effect: { type: 'multiplier', basisPoints: 15000 },
    }));

    expect(await shiftStatus(db, 'rule-target')).toBe('stale');
  });

  it('targets staleness when a special-interval rule is edited and deleted', async () => {
    await seedFinalizedShift(db, 'rule-target', 'profile', '2026-08-24T08:00:00Z', '2026-08-24T09:00:00Z', {});
    await seedFinalizedShift(db, 'rule-unrelated', 'profile', '2026-08-24T11:00:00Z', '2026-08-24T12:00:00Z', {});
    await intervals.save(evidence({
      id: 'rule-evidence', start: '2026-08-24T08:30:00Z', end: '2026-08-24T09:30:00Z',
    }));
    const repository = new SqlitePayRuleRepository(db);
    const initial = createPayRule({
      id: 'special-rule', salaryProfileId: 'profile',
      conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      premiumFamily: 'special_interval', effect: { type: 'multiplier', basisPoints: 15_000 },
    });
    await repository.save(initial);
    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized'");
    const snapshotsBefore = await db.getAllAsync<{ id: string; result_json: string }>(
      'SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id',
    );

    await repository.save({
      ...initial,
      effect: { type: 'multiplier', basisPoints: 17_500 },
      updatedAt: '2026-08-25T00:00:00Z',
    });
    expect(await shiftStatus(db, 'rule-target')).toBe('stale');
    expect(await shiftStatus(db, 'rule-unrelated')).toBe('finalized');

    await db.runAsync("UPDATE shifts SET salary_calculation_status='finalized'");
    await repository.delete(initial.id);
    expect(await shiftStatus(db, 'rule-target')).toBe('stale');
    expect(await shiftStatus(db, 'rule-unrelated')).toBe('finalized');
    expect(await db.getAllAsync('SELECT id, result_json FROM salary_calculation_snapshots ORDER BY id'))
      .toEqual(snapshotsBefore);
    expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('clones the confirmed recurring-rest configuration into an effective-dated profile version', async () => {
    const enabled = schedule({ enabled: true, confirmedAt: timestamp });
    await schedules.save(enabled);
    const profiles = new SqliteSalaryProfileRepository(db);
    const previous = createSalaryProfile({
      id: 'profile', workplaceId: 'wp', effectiveFrom: '2026-01-01',
      effectiveTo: '2026-08-31', createdAt: timestamp, updatedAt: timestamp,
    });
    const next = createSalaryProfile({
      id: 'profile-next', workplaceId: 'wp', effectiveFrom: '2026-09-01',
      createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
    });

    await profiles.createVersion(previous, next);

    const cloned = await schedules.getForProfile(next.id);
    expect(cloned).toMatchObject({
      workplaceId: 'wp', salaryProfileId: next.id, label: enabled.label,
      startWeekday: enabled.startWeekday, startTime: enabled.startTime,
      endWeekday: enabled.endWeekday, endTime: enabled.endTime,
      enabled: true, confirmedAt: timestamp,
    });
    expect(cloned?.id).not.toBe(enabled.id);
  });
});

function evidence(overrides: Partial<CalendarEvidenceInterval> = {}): CalendarEvidenceInterval {
  return {
    id: 'holiday', workplaceId: 'wp', salaryProfileId: 'profile', type: 'holiday',
    name: 'Configured holiday', start: '2026-08-24T08:00:00Z', end: '2026-08-24T10:00:00Z',
    timezone: 'Asia/Jerusalem', sourceKind: 'confirmed_preset', sourceTitle: 'Fixture',
    sourceUrl: 'https://example.com/source', presetId: 'fixture', presetVersion: '1',
    confirmedAt: timestamp, isArchived: false, createdAt: timestamp, updatedAt: timestamp,
    ...overrides,
  };
}

function schedule(overrides: Partial<WeeklyRestSchedule> = {}): WeeklyRestSchedule {
  return {
    id: 'rest', workplaceId: 'wp', salaryProfileId: 'profile', label: 'Weekly rest',
    startWeekday: 5, startTime: '18:00', endWeekday: 6, endTime: '18:00',
    enabled: false, sourceKind: 'manual', isArchived: false, createdAt: timestamp,
    updatedAt: timestamp, ...overrides,
  };
}

async function seedProfile(db: SQLite.SQLiteDatabase, workplaceId: string, profileId: string) {
  await db.runAsync(
    'INSERT INTO workplaces (id, name, default_hourly_rate_minor, created_at, updated_at) VALUES (?, ?, 6000, ?, ?)',
    workplaceId, workplaceId, timestamp, timestamp,
  );
  await db.runAsync(`INSERT INTO salary_profiles (
    id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
    created_at, updated_at
  ) VALUES (?, ?, ?, 'ILS', 6000, 'perBreak', 'Asia/Jerusalem', ?, ?)`,
  profileId, workplaceId, profileId, timestamp, timestamp);
}

async function seedFinalizedShift(
  db: SQLite.SQLiteDatabase,
  id: string,
  profileId: string,
  start: string,
  end: string,
  result: object,
) {
  await db.runAsync(`INSERT INTO shifts (
    id, workplace_id, salary_profile_id, scheduled_start, scheduled_end, actual_start, actual_end,
    payable_start, payable_end, expected_break_minutes, payable_break_minutes, status,
    hourly_rate_snapshot_minor, payable_source, completed_at, salary_calculation_status,
    timezone, created_at, updated_at
  ) VALUES (?, 'wp', ?, ?, ?, ?, ?, ?, ?, 0, 0, 'completed', 6000, 'actual', ?, 'finalized',
    'Asia/Jerusalem', ?, ?)`, id, profileId, start, end, start, end, start, end, end, timestamp, timestamp);
  await db.runAsync(`INSERT INTO salary_calculation_snapshots (
    id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor,
    payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor,
    fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version,
    calculated_at, is_current, created_at
  ) VALUES (?, ?, 1, 'finalized', 'completed', ?, 6000, 60, 60, 0, 6000, 0, 0, 0,
    6000, ?, 'test', ?, 1, ?)`, `snapshot-${id}`, id, profileId, JSON.stringify(result),
  timestamp, timestamp);
}

async function shiftStatus(db: SQLite.SQLiteDatabase, id: string): Promise<string | undefined> {
  return (await db.getFirstAsync<{ salary_calculation_status: string }>(
    'SELECT salary_calculation_status FROM shifts WHERE id = ?', id,
  ))?.salary_calculation_status;
}
