import type { SQLiteDatabase } from 'expo-sqlite';

import { SqlitePayRuleRepository, SqliteSalaryCalculationRepository, SqliteSalaryProfileRepository } from '@/data/repositories';
import { calculateSalary } from '@/domain/services';
import { weeklyRestPayRuleId } from '@/domain/services/weekly-rest-pay-rule-service';
import { createPayRule, createSalaryProfile, createShift } from '@/test/fixtures';

describe('SQLite salary repositories', () => {
  it('persists profiles in minor units and resolves effective versions', async () => {
    const row = {
      id: 'profile-1', workplace_id: 'workplace-1', name: 'July', currency: 'ILS', timezone: 'Asia/Jerusalem',
      standard_hourly_rate_minor: 5850, default_travel_reimbursement_minor: 1200, default_shift_bonus_minor: 0,
      calculation_rounding_mode: 'half_up', break_policy: 'perBreak', effective_from: '2026-07-01', effective_to: null,
      workweek_start_weekday: 0, weekly_overtime_enabled: 1, weekly_regular_minutes: 2520,
      weekly_overtime_multiplier_basis_points: 12500, weekly_overtime_basis: 'net',
      is_active: 1, is_archived: 0, created_at: '2026-07-01T00:00:00+03:00', updated_at: '2026-07-01T00:00:00+03:00',
    };
    const database = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }), getFirstAsync: jest.fn().mockResolvedValue(row) };
    const repository = new SqliteSalaryProfileRepository(database as unknown as SQLiteDatabase);
    const profile = createSalaryProfile({ baseHourlyRateMinor: 5850, defaultTravelReimbursementMinor: 1200, effectiveFrom: '2026-07-01', weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2520, weeklyOvertimeMultiplierBasisPoints: 12500 });
    await repository.create(profile);
    await expect(repository.resolveForDate('workplace-1', '2026-07-15')).resolves.toMatchObject({ baseHourlyRateMinor: 5850, effectiveFrom: '2026-07-01', workweekStartWeekday: 0, weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2520, weeklyOvertimeMultiplierBasisPoints: 12500, weeklyOvertimeBasis: 'net' });
    expect(database.runAsync.mock.calls[0]?.[0]).toContain('standard_hourly_rate_minor');
    expect(database.runAsync.mock.calls[0]?.slice(1)).toEqual(expect.arrayContaining([5850, 1200, 2520, 12500, '2026-07-01']));
  });

  it('preserves an unattached legacy profile as readable recovery data', async () => {
    const row = {
      id: 'legacy-orphan', workplace_id: null, name: 'Legacy', currency: 'ILS', timezone: 'Asia/Jerusalem',
      standard_hourly_rate_minor: 5000, default_travel_reimbursement_minor: 0, default_shift_bonus_minor: 0,
      calculation_rounding_mode: 'half_up', break_policy: 'unpaid', effective_from: null, effective_to: null,
      workweek_start_weekday: 0, weekly_overtime_enabled: 0, weekly_regular_minutes: null,
      weekly_overtime_multiplier_basis_points: null, weekly_overtime_basis: 'net',
      is_active: 0, is_archived: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
    const repository = new SqliteSalaryProfileRepository({ getFirstAsync: jest.fn().mockResolvedValue(row) } as unknown as SQLiteDatabase);
    await expect(repository.getById(row.id)).resolves.toMatchObject({ id: row.id, workplaceId: undefined });
  });

  it('creates a new effective rate version transactionally without overwriting history', async () => {
    const database = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }), withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()) };
    const repository = new SqliteSalaryProfileRepository(database as unknown as SQLiteDatabase);
    const previous = createSalaryProfile({ id: 'old', effectiveFrom: '2026-01-01', effectiveTo: '2026-07-31', baseHourlyRateMinor: 5000, workweekStartWeekday: 0 });
    const next = createSalaryProfile({ id: 'new', effectiveFrom: '2026-08-01', baseHourlyRateMinor: 6000, workweekStartWeekday: 1, weeklyOvertimeEnabled: true, weeklyRegularMinutes: 2400, weeklyOvertimeMultiplierBasisPoints: 15000, weeklyOvertimeBasis: 'gross' });
    await repository.createVersion(previous, next);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).toHaveBeenCalledTimes(5);
    expect(database.runAsync.mock.calls[2]?.[0]).toContain('INSERT INTO pay_rules');
    expect(database.runAsync.mock.calls[2]?.[0]).toContain('CASE WHEN id = ? THEN ?');
    expect(database.runAsync.mock.calls[2]?.slice(1)).toEqual(expect.arrayContaining([
      weeklyRestPayRuleId(previous.id), weeklyRestPayRuleId(next.id),
    ]));
    expect(database.runAsync.mock.calls[3]?.[0]).toContain('INSERT INTO weekly_rest_schedules');
    expect(database.runAsync.mock.calls[4]?.[0]).toContain('UPDATE workplaces');
    expect(database.runAsync.mock.calls[1]?.slice(1)).toEqual(expect.arrayContaining([1, 1, 2400, 15000, 'gross']));
  });

  it('propagates a profile-version rule-copy failure so SQLite can roll back all changes', async () => {
    const database = { runAsync: jest.fn().mockResolvedValueOnce({ changes: 1 }).mockResolvedValueOnce({ changes: 1 }).mockRejectedValueOnce(new Error('disk full')), withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()) };
    const repository = new SqliteSalaryProfileRepository(database as unknown as SQLiteDatabase);
    const previous = createSalaryProfile({ id: 'old', effectiveFrom: '2026-01-01', effectiveTo: '2026-07-31' });
    const next = createSalaryProfile({ id: 'new', effectiveFrom: '2026-08-01' });
    await expect(repository.createVersion(previous, next)).rejects.toThrow('disk full');
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('round-trips typed rule JSON and orders by priority', async () => {
    const rule = createPayRule({ id: 'night', priority: 20, conditions: [{ type: 'timeWindow', startTime: '22:00', endTime: '06:00' }], effect: { type: 'multiplier', basisPoints: 12500 } });
    const database = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([{ id: rule.id, salary_profile_id: rule.salaryProfileId, name: rule.name, priority: rule.priority, conditions_json: JSON.stringify(rule.conditions), effect_json: JSON.stringify(rule.effect), can_stack: 0, premium_family: null, is_enabled: 1, effective_from: null, effective_to: null, created_at: rule.createdAt, updated_at: rule.updatedAt }]),
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    const repository = new SqlitePayRuleRepository(database as unknown as SQLiteDatabase);
    await repository.save(rule);
    await expect(repository.listForProfile(rule.salaryProfileId)).resolves.toEqual([rule]);
    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY priority DESC, id ASC'), rule.salaryProfileId);
  });

  it('versions snapshots transactionally and preserves history JSON', async () => {
    const shift = createShift({ expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0 });
    const profile = createSalaryProfile({ baseHourlyRateMinor: 6000 });
    const result = calculateSalary({ shift, profile, rules: [], breaks: [], holidayIntervals: [], calculatedAt: '2026-07-15T23:00:00+03:00' });
    const database = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    const repository = new SqliteSalaryCalculationRepository(database as unknown as SQLiteDatabase);
    await repository.saveSnapshot({ id: 'snapshot-1', shiftId: shift.id, version: 1, status: 'estimated', salaryProfileId: profile.id, result, isCurrent: true, createdAt: result.calculatedAt });
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync.mock.calls[0]?.[0]).toContain('is_current = 0');
    expect(database.runAsync.mock.calls[1]?.join(' ')).toContain('salary_calculation_snapshots');
    expect(database.runAsync.mock.calls[2]?.[0]).toContain('salary_calculation_status');
    expect(database.runAsync.mock.calls[2]?.slice(1)).toContain(result.resolvedBaseHourlyRateMinor);
  });
});
