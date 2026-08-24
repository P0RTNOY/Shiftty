import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import {
  payCalculationResultSchema,
  payRuleSchema,
  salaryCalculationSnapshotSchema,
  salaryProfileSchema,
  type PayRule,
  type SalaryCalculationSnapshot,
  type SalaryProfile,
} from '@/domain/entities';
import type { PayRuleRepository, SalaryCalculationRepository, SalaryProfileRepository } from '@/domain/repositories';

interface SalaryProfileRow {
  id: string; workplace_id: string | null; name: string; currency: string; timezone: string;
  standard_hourly_rate_minor: number; default_travel_reimbursement_minor: number; default_shift_bonus_minor: number;
  calculation_rounding_mode: 'half_up' | 'floor' | 'ceiling'; break_policy: 'paid' | 'unpaid' | 'perBreak';
  workweek_start_weekday: number; weekly_overtime_enabled: number; weekly_regular_minutes: number | null;
  weekly_overtime_multiplier_basis_points: number | null; weekly_overtime_basis: 'net' | 'gross';
  effective_from: string | null; effective_to: string | null; is_active: number; is_archived: number; created_at: string; updated_at: string;
}
interface PayRuleRow {
  id: string; salary_profile_id: string; name: string; priority: number; conditions_json: string; effect_json: string;
  can_stack: number; is_enabled: number; effective_from: string | null; effective_to: string | null; created_at: string; updated_at: string;
}
interface SnapshotRow {
  id: string; shift_id: string; version: number; status: 'estimated' | 'finalized' | 'incomplete';
  salary_profile_id: string | null; result_json: string; is_current: number; created_at: string;
}

export class SqliteSalaryProfileRepository implements SalaryProfileRepository {
  constructor(private readonly database: SQLiteDatabase) {}
  create(profile: SalaryProfile): Promise<void> { return this.save(profile, true); }
  update(profile: SalaryProfile): Promise<void> { return this.save(profile, false); }
  async createVersion(previousInput: SalaryProfile, nextInput: SalaryProfile): Promise<void> {
    const previous = salaryProfileSchema.parse(previousInput); const next = salaryProfileSchema.parse(nextInput);
    if (!previous.workplaceId || previous.workplaceId !== next.workplaceId || previous.id === next.id || !next.effectiveFrom) throw new Error('Invalid salary profile version.');
    await this.database.withTransactionAsync(async () => {
      await this.save(previous, false);
      await this.save(next, true);
      await this.database.runAsync(`INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack,
        is_enabled, effective_from, effective_to, created_at, updated_at)
        SELECT id || '__version__' || ?, ?, name, priority, conditions_json, effect_json, can_stack,
          is_enabled, effective_from, effective_to, ?, ? FROM pay_rules WHERE salary_profile_id = ?;`,
      next.id, next.id, next.createdAt, next.updatedAt, previous.id);
      await this.database.runAsync('UPDATE workplaces SET salary_profile_id = ?, updated_at = ? WHERE id = ? AND salary_profile_id = ?;', next.id, next.updatedAt, next.workplaceId!, previous.id);
    });
  }
  async getById(id: string): Promise<SalaryProfile | null> { const row = await this.database.getFirstAsync<SalaryProfileRow>('SELECT * FROM salary_profiles WHERE id = ?;', id); return row ? mapProfile(row) : null; }
  async listByWorkplace(workplaceId: string): Promise<SalaryProfile[]> { const rows = await this.database.getAllAsync<SalaryProfileRow>('SELECT * FROM salary_profiles WHERE workplace_id = ? ORDER BY effective_from DESC, created_at DESC;', workplaceId); return rows.map(mapProfile); }
  async resolveForDate(workplaceId: string, localDate: string): Promise<SalaryProfile | null> {
    const row = await this.database.getFirstAsync<SalaryProfileRow>(
      `SELECT * FROM salary_profiles WHERE workplace_id = ? AND is_active = 1 AND is_archived = 0
       AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)
       ORDER BY COALESCE(effective_from, '') DESC, created_at DESC, id ASC LIMIT 1;`, workplaceId, localDate, localDate,
    );
    return row ? mapProfile(row) : null;
  }
  private async save(input: SalaryProfile, insertOnly: boolean): Promise<void> {
    const profile = salaryProfileSchema.parse(input);
    const sql = `INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone,
      default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, workweek_start_weekday,
      weekly_overtime_enabled, weekly_regular_minutes, weekly_overtime_multiplier_basis_points, weekly_overtime_basis,
      effective_from, effective_to, is_active, is_archived, created_at, updated_at) VALUES (${Array.from({ length: 21 }, () => '?').join(', ')})
      ${insertOnly ? '' : `ON CONFLICT(id) DO UPDATE SET workplace_id=excluded.workplace_id, name=excluded.name, currency=excluded.currency,
      standard_hourly_rate_minor=excluded.standard_hourly_rate_minor, break_policy=excluded.break_policy, timezone=excluded.timezone,
      default_travel_reimbursement_minor=excluded.default_travel_reimbursement_minor, default_shift_bonus_minor=excluded.default_shift_bonus_minor,
      calculation_rounding_mode=excluded.calculation_rounding_mode, workweek_start_weekday=excluded.workweek_start_weekday,
      weekly_overtime_enabled=excluded.weekly_overtime_enabled, weekly_regular_minutes=excluded.weekly_regular_minutes,
      weekly_overtime_multiplier_basis_points=excluded.weekly_overtime_multiplier_basis_points, weekly_overtime_basis=excluded.weekly_overtime_basis,
      effective_from=excluded.effective_from, effective_to=excluded.effective_to,
      is_active=excluded.is_active, is_archived=excluded.is_archived, updated_at=excluded.updated_at`};`;
    if (!profile.workplaceId) throw new Error('New salary profiles require a workplace.');
    await this.database.runAsync(sql, profile.id, profile.workplaceId, profile.name, profile.currency, profile.baseHourlyRateMinor,
      profile.breakPolicy, profile.timezone, profile.defaultTravelReimbursementMinor, profile.defaultShiftBonusMinor,
      profile.calculationRoundingMode, profile.workweekStartWeekday, profile.weeklyOvertimeEnabled ? 1 : 0,
      profile.weeklyRegularMinutes ?? null, profile.weeklyOvertimeMultiplierBasisPoints ?? null, profile.weeklyOvertimeBasis,
      profile.effectiveFrom ?? null, profile.effectiveTo ?? null, profile.isActive ? 1 : 0,
      profile.isArchived ? 1 : 0, profile.createdAt, profile.updatedAt);
  }
}

export class SqlitePayRuleRepository implements PayRuleRepository {
  constructor(private readonly database: SQLiteDatabase) {}
  async save(input: PayRule): Promise<void> {
    const rule = payRuleSchema.parse(input);
    await this.database.runAsync(`INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, is_enabled, effective_from, effective_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET salary_profile_id=excluded.salary_profile_id,
      name=excluded.name, priority=excluded.priority, conditions_json=excluded.conditions_json, effect_json=excluded.effect_json,
      can_stack=excluded.can_stack, is_enabled=excluded.is_enabled, effective_from=excluded.effective_from,
      effective_to=excluded.effective_to, updated_at=excluded.updated_at;`, ...toRuleParams(rule));
  }
  async getById(id: string): Promise<PayRule | null> { const row = await this.database.getFirstAsync<PayRuleRow>('SELECT * FROM pay_rules WHERE id = ?;', id); return row ? mapRule(row) : null; }
  async listForProfile(profileId: string): Promise<PayRule[]> { const rows = await this.database.getAllAsync<PayRuleRow>('SELECT * FROM pay_rules WHERE salary_profile_id = ? ORDER BY priority DESC, id ASC;', profileId); return rows.map(mapRule); }
  async delete(id: string): Promise<void> { await this.database.runAsync('DELETE FROM pay_rules WHERE id = ?;', id); }
}

export class SqliteSalaryCalculationRepository implements SalaryCalculationRepository {
  constructor(private readonly database: SQLiteDatabase) {}
  async saveSnapshot(input: SalaryCalculationSnapshot): Promise<void> {
    const snapshot = salaryCalculationSnapshotSchema.parse(input);
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync('UPDATE salary_calculation_snapshots SET is_current = 0 WHERE shift_id = ? AND is_current = 1;', snapshot.shiftId);
      const result = snapshot.result;
      await this.database.runAsync(`INSERT INTO salary_calculation_snapshots (id, shift_id, version, status, context, salary_profile_id,
        resolved_rate_minor, payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor,
        fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at)
        VALUES (${Array.from({ length: 20 }, () => '?').join(', ')});`, snapshot.id, snapshot.shiftId, snapshot.version, snapshot.status,
        result.context, snapshot.salaryProfileId ?? null, result.resolvedBaseHourlyRateMinor ?? null, result.payableMinutes,
        result.regularMinutes, result.specialRateMinutes, result.basePayMinor, result.premiumPayMinor, result.fixedBonusesMinor,
        result.reimbursementsMinor, result.totalGrossPayMinor ?? null, JSON.stringify(result), result.engineVersion, result.calculatedAt,
        snapshot.isCurrent ? 1 : 0, snapshot.createdAt);
      const status = snapshot.status === 'finalized' ? 'finalized' : snapshot.status === 'incomplete' ? 'incomplete' : 'estimated';
      await this.database.runAsync(`UPDATE shifts SET salary_calculation_status = ?, hourly_rate_snapshot_minor = COALESCE(?, hourly_rate_snapshot_minor), payable_gross_pay_minor = CASE WHEN status = 'completed' THEN ? ELSE payable_gross_pay_minor END,
        expected_gross_pay_minor = CASE WHEN status = 'scheduled' THEN ? ELSE expected_gross_pay_minor END WHERE id = ?;`,
      status, result.resolvedBaseHourlyRateMinor ?? null, result.totalGrossPayMinor ?? null, result.totalGrossPayMinor ?? null, snapshot.shiftId);
    });
  }
  async getLatestForShift(shiftId: string): Promise<SalaryCalculationSnapshot | null> { const row = await this.database.getFirstAsync<SnapshotRow>('SELECT * FROM salary_calculation_snapshots WHERE shift_id = ? AND is_current = 1 LIMIT 1;', shiftId); return row ? mapSnapshot(row) : null; }
  async listHistory(shiftId: string): Promise<SalaryCalculationSnapshot[]> { const rows = await this.database.getAllAsync<SnapshotRow>('SELECT * FROM salary_calculation_snapshots WHERE shift_id = ? ORDER BY version DESC;', shiftId); return rows.map(mapSnapshot); }
  async listCurrentForShifts(shiftIds: readonly string[]): Promise<SalaryCalculationSnapshot[]> {
    if (!shiftIds.length) return [];
    const rows = await this.database.getAllAsync<SnapshotRow>(`SELECT * FROM salary_calculation_snapshots WHERE is_current = 1 AND shift_id IN (${shiftIds.map(() => '?').join(', ')});`, ...(shiftIds as SQLiteBindValue[]));
    return rows.map(mapSnapshot);
  }
  async markStale(shiftId: string): Promise<void> { await this.database.runAsync("UPDATE shifts SET salary_calculation_status = 'stale' WHERE id = ? AND salary_calculation_status = 'finalized';", shiftId); }
  async markIncomplete(shiftId: string): Promise<void> { await this.database.runAsync("UPDATE shifts SET salary_calculation_status = 'incomplete' WHERE id = ? AND status = 'completed';", shiftId); }
}

function mapProfile(row: SalaryProfileRow): SalaryProfile { return salaryProfileSchema.parse({ id: row.id, workplaceId: row.workplace_id ?? undefined,
  name: row.name, currency: row.currency, timezone: row.timezone, baseHourlyRateMinor: row.standard_hourly_rate_minor,
  defaultTravelReimbursementMinor: row.default_travel_reimbursement_minor, defaultShiftBonusMinor: row.default_shift_bonus_minor,
  calculationRoundingMode: row.calculation_rounding_mode, breakPolicy: row.break_policy,
  workweekStartWeekday: row.workweek_start_weekday, weeklyOvertimeEnabled: row.weekly_overtime_enabled === 1,
  weeklyRegularMinutes: row.weekly_regular_minutes ?? undefined,
  weeklyOvertimeMultiplierBasisPoints: row.weekly_overtime_multiplier_basis_points ?? undefined,
  weeklyOvertimeBasis: row.weekly_overtime_basis, effectiveFrom: row.effective_from ?? undefined,
  effectiveTo: row.effective_to ?? undefined, isActive: row.is_active === 1, isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at }); }
function toRuleParams(rule: PayRule): SQLiteBindValue[] { return [rule.id, rule.salaryProfileId, rule.name, rule.priority, JSON.stringify(rule.conditions), JSON.stringify(rule.effect), rule.canStack ? 1 : 0, rule.isEnabled ? 1 : 0, rule.effectiveFrom ?? null, rule.effectiveTo ?? null, rule.createdAt, rule.updatedAt]; }
function mapRule(row: PayRuleRow): PayRule { return payRuleSchema.parse({ id: row.id, salaryProfileId: row.salary_profile_id, name: row.name,
  priority: row.priority, conditions: JSON.parse(row.conditions_json), effect: JSON.parse(row.effect_json), canStack: row.can_stack === 1,
  isEnabled: row.is_enabled === 1, effectiveFrom: row.effective_from ?? undefined, effectiveTo: row.effective_to ?? undefined,
  createdAt: row.created_at, updatedAt: row.updated_at }); }
function mapSnapshot(row: SnapshotRow): SalaryCalculationSnapshot { return salaryCalculationSnapshotSchema.parse({ id: row.id, shiftId: row.shift_id,
  version: row.version, status: row.status, salaryProfileId: row.salary_profile_id ?? undefined, result: payCalculationResultSchema.parse(JSON.parse(row.result_json)),
  isCurrent: row.is_current === 1, createdAt: row.created_at }); }
