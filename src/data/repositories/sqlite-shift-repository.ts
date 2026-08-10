import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import { shiftSchema, type Shift, type ShiftStatus } from '@/domain/entities';
import type { ShiftQuery, ShiftRepository } from '@/domain/repositories';

interface ShiftRow {
  id: string;
  workplace_id: string;
  role_id: string | null;
  salary_profile_id: string | null;
  title: string | null;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  payable_start: string | null;
  payable_end: string | null;
  expected_break_minutes: number;
  actual_break_minutes: number | null;
  payable_break_minutes: number | null;
  status: ShiftStatus;
  hourly_rate_snapshot_minor: number;
  expected_gross_pay_minor: number | null;
  actual_gross_pay_minor: number | null;
  payable_gross_pay_minor: number | null;
  shift_template_id: string | null;
  recurrence_group_id: string | null;
  recurrence_original_start: string | null;
  recurrence_exception_type: 'modified' | null;
  cancelled_at: string | null;
  expected_end: string | null;
  active_origin: 'scheduled' | 'unscheduled' | null;
  payable_source: 'actual' | 'scheduled' | 'rounded' | 'manual' | null;
  completed_at: string | null;
  hourly_rate_override_minor: number | null;
  fixed_bonus_override_minor: number | null;
  travel_reimbursement_override_minor: number | null;
  salary_calculation_status: Shift['salaryCalculationStatus'];
  timezone: string;
  created_at: string;
  updated_at: string;
}

export const SHIFT_COLUMNS = `
  id, workplace_id, role_id, salary_profile_id, title, notes,
  scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end,
  expected_break_minutes, actual_break_minutes, payable_break_minutes, status,
  hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor,
  payable_gross_pay_minor, shift_template_id, recurrence_group_id, recurrence_original_start,
  recurrence_exception_type, cancelled_at, expected_end, active_origin, payable_source,
  completed_at, hourly_rate_override_minor, fixed_bonus_override_minor,
  travel_reimbursement_override_minor, salary_calculation_status, timezone, created_at, updated_at
`;
export const SHIFT_COLUMN_COUNT = 36;
const DISPLAY_START_EXPRESSION = "CASE status WHEN 'completed' THEN COALESCE(actual_start, payable_start, scheduled_start) WHEN 'active' THEN COALESCE(actual_start, scheduled_start) ELSE COALESCE(scheduled_start, actual_start, payable_start) END";
const DISPLAY_END_EXPRESSION = "CASE status WHEN 'completed' THEN COALESCE(actual_end, payable_end, scheduled_end) WHEN 'active' THEN COALESCE(actual_end, expected_end, scheduled_end, actual_start) ELSE COALESCE(scheduled_end, actual_end, payable_end) END";

export class SqliteShiftRepository implements ShiftRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getById(id: string): Promise<Shift | null> {
    const row = await this.database.getFirstAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = ?;`,
      id,
    );
    return row ? mapShiftRow(row) : null;
  }

  async findActive(): Promise<Shift | null> {
    const row = await this.database.getFirstAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE status = 'active' LIMIT 1;`,
    );
    return row ? mapShiftRow(row) : null;
  }

  async list(query: ShiftQuery = {}): Promise<Shift[]> {
    const clauses: string[] = [];
    const parameters: SQLiteBindValue[] = [];
    const startExpression = query.rangeSource === 'salary'
      ? "CASE status WHEN 'completed' THEN COALESCE(payable_start, actual_start, scheduled_start) WHEN 'active' THEN COALESCE(actual_start, scheduled_start) ELSE scheduled_start END"
      : DISPLAY_START_EXPRESSION;
    const endExpression = query.rangeSource === 'salary'
      ? "CASE status WHEN 'completed' THEN COALESCE(payable_end, actual_end, scheduled_end) WHEN 'active' THEN COALESCE(actual_end, expected_end, scheduled_end, actual_start) ELSE scheduled_end END"
      : DISPLAY_END_EXPRESSION;

    if (query.startsBefore) {
      clauses.push(`julianday(${startExpression}) < julianday(?)`);
      parameters.push(query.startsBefore);
    }
    if (query.endsAfter) {
      clauses.push(`julianday(${endExpression}) > julianday(?)`);
      parameters.push(query.endsAfter);
    }
    if (query.workplaceId) {
      clauses.push('workplace_id = ?');
      parameters.push(query.workplaceId);
    }
    if (query.recurrenceGroupId) {
      clauses.push('recurrence_group_id = ?');
      parameters.push(query.recurrenceGroupId);
    }
    if (query.statuses?.length) {
      clauses.push(`status IN (${query.statuses.map(() => '?').join(', ')})`);
      parameters.push(...query.statuses);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.database.getAllAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts ${where} ORDER BY julianday(${startExpression}) ASC;`,
      ...parameters,
    );
    return rows.map(mapShiftRow);
  }

  async listUpcoming(after: string, limit = 50): Promise<Shift[]> {
    const rows = await this.database.getAllAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts
       WHERE status = 'scheduled' AND julianday(scheduled_start) >= julianday(?)
       ORDER BY scheduled_start ASC LIMIT ?;`,
      after,
      limit,
    );
    return rows.map(mapShiftRow);
  }

  async getNextScheduled(after: string): Promise<Shift | null> {
    const row = await this.database.getFirstAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts
       WHERE status = 'scheduled' AND julianday(scheduled_start) >= julianday(?)
       ORDER BY scheduled_start ASC LIMIT 1;`,
      after,
    );
    return row ? mapShiftRow(row) : null;
  }

  async findOverlapping(range: { start: string; end: string }, excludeId?: string): Promise<Shift[]> {
    const exclude = excludeId ? 'AND id != ?' : '';
    const parameters: SQLiteBindValue[] = [range.end, range.start];
    if (excludeId) parameters.push(excludeId);
    const rows = await this.database.getAllAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts
       WHERE status != 'cancelled'
         AND julianday(${DISPLAY_START_EXPRESSION}) < julianday(?)
         AND julianday(${DISPLAY_END_EXPRESSION}) > julianday(?)
         ${exclude}
       ORDER BY julianday(${DISPLAY_START_EXPRESSION}) ASC;`,
      ...parameters,
    );
    return rows.map(mapShiftRow);
  }

  async create(input: Shift): Promise<void> {
    const shift = shiftSchema.parse(input);
    await this.database.runAsync(
      `INSERT INTO shifts (${SHIFT_COLUMNS}) VALUES (${Array.from({ length: SHIFT_COLUMN_COUNT }, () => '?').join(', ')});`,
      ...toShiftParameters(shift),
    );
  }

  async update(shift: Shift): Promise<void> {
    await this.save(shift);
  }

  async save(input: Shift): Promise<void> {
    const shift = shiftSchema.parse(input);
    await this.database.runAsync(
      `
        INSERT INTO shifts (
          ${SHIFT_COLUMNS}
        ) VALUES (${Array.from({ length: SHIFT_COLUMN_COUNT }, () => '?').join(', ')})
        ON CONFLICT(id) DO UPDATE SET
          workplace_id = excluded.workplace_id,
          role_id = excluded.role_id,
          salary_profile_id = excluded.salary_profile_id,
          title = excluded.title,
          notes = excluded.notes,
          scheduled_start = excluded.scheduled_start,
          scheduled_end = excluded.scheduled_end,
          actual_start = excluded.actual_start,
          actual_end = excluded.actual_end,
          payable_start = excluded.payable_start,
          payable_end = excluded.payable_end,
          expected_break_minutes = excluded.expected_break_minutes,
          actual_break_minutes = excluded.actual_break_minutes,
          payable_break_minutes = excluded.payable_break_minutes,
          status = excluded.status,
          hourly_rate_snapshot_minor = excluded.hourly_rate_snapshot_minor,
          expected_gross_pay_minor = excluded.expected_gross_pay_minor,
          actual_gross_pay_minor = excluded.actual_gross_pay_minor,
          payable_gross_pay_minor = excluded.payable_gross_pay_minor,
          shift_template_id = excluded.shift_template_id,
          recurrence_group_id = excluded.recurrence_group_id,
          recurrence_original_start = excluded.recurrence_original_start,
          recurrence_exception_type = excluded.recurrence_exception_type,
          cancelled_at = excluded.cancelled_at,
          expected_end = excluded.expected_end,
          active_origin = excluded.active_origin,
          payable_source = excluded.payable_source,
          completed_at = excluded.completed_at,
          hourly_rate_override_minor = excluded.hourly_rate_override_minor,
          fixed_bonus_override_minor = excluded.fixed_bonus_override_minor,
          travel_reimbursement_override_minor = excluded.travel_reimbursement_override_minor,
          salary_calculation_status = excluded.salary_calculation_status,
          timezone = excluded.timezone,
          updated_at = excluded.updated_at;
      `,
      ...toShiftParameters(shift),
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM shifts WHERE id = ?;', id);
  }

  async saveMany(shifts: readonly Shift[]): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const shift of shifts) await this.save(shift);
    });
  }

  async deleteMany(ids: readonly string[]): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const id of ids) await this.delete(id);
    });
  }
}

export function toShiftParameters(shift: Shift): SQLiteBindValue[] {
  return [
    shift.id,
    shift.workplaceId,
    shift.roleId ?? null,
    shift.salaryProfileId ?? null,
    shift.title ?? null,
    shift.notes ?? null,
    shift.scheduledStart ?? null,
    shift.scheduledEnd ?? null,
    shift.actualStart ?? null,
    shift.actualEnd ?? null,
    shift.payableStart ?? null,
    shift.payableEnd ?? null,
    shift.expectedBreakMinutes,
    shift.actualBreakMinutes ?? null,
    shift.payableBreakMinutes ?? null,
    shift.status,
    shift.hourlyRateSnapshotMinor,
    shift.expectedGrossPayMinor ?? null,
    shift.actualGrossPayMinor ?? null,
    shift.payableGrossPayMinor ?? null,
    shift.shiftTemplateId ?? null,
    shift.recurrenceGroupId ?? null,
    shift.recurrenceOriginalStart ?? null,
    shift.recurrenceExceptionType ?? null,
    shift.cancelledAt ?? null,
    shift.expectedEnd ?? null,
    shift.activeOrigin ?? null,
    shift.payableSource ?? null,
    shift.completedAt ?? null,
    shift.hourlyRateOverrideMinor ?? null,
    shift.fixedBonusOverrideMinor ?? null,
    shift.travelReimbursementOverrideMinor ?? null,
    shift.salaryCalculationStatus,
    shift.timezone,
    shift.createdAt,
    shift.updatedAt,
  ];
}

export function mapShiftRow(row: ShiftRow): Shift {
  return shiftSchema.parse({
    id: row.id,
    workplaceId: row.workplace_id,
    roleId: row.role_id ?? undefined,
    salaryProfileId: row.salary_profile_id ?? undefined,
    title: row.title ?? undefined,
    notes: row.notes ?? undefined,
    scheduledStart: row.scheduled_start ?? undefined,
    scheduledEnd: row.scheduled_end ?? undefined,
    actualStart: row.actual_start ?? undefined,
    actualEnd: row.actual_end ?? undefined,
    payableStart: row.payable_start ?? undefined,
    payableEnd: row.payable_end ?? undefined,
    expectedBreakMinutes: row.expected_break_minutes,
    actualBreakMinutes: row.actual_break_minutes ?? undefined,
    payableBreakMinutes: row.payable_break_minutes ?? undefined,
    status: row.status,
    hourlyRateSnapshotMinor: row.hourly_rate_snapshot_minor,
    expectedGrossPayMinor: row.expected_gross_pay_minor ?? undefined,
    actualGrossPayMinor: row.actual_gross_pay_minor ?? undefined,
    payableGrossPayMinor: row.payable_gross_pay_minor ?? undefined,
    shiftTemplateId: row.shift_template_id ?? undefined,
    recurrenceGroupId: row.recurrence_group_id ?? undefined,
    recurrenceOriginalStart: row.recurrence_original_start ?? undefined,
    recurrenceExceptionType: row.recurrence_exception_type ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    expectedEnd: row.expected_end ?? undefined,
    activeOrigin: row.active_origin ?? undefined,
    payableSource: row.payable_source ?? undefined,
    completedAt: row.completed_at ?? undefined,
    hourlyRateOverrideMinor: row.hourly_rate_override_minor ?? undefined,
    fixedBonusOverrideMinor: row.fixed_bonus_override_minor ?? undefined,
    travelReimbursementOverrideMinor: row.travel_reimbursement_override_minor ?? undefined,
    salaryCalculationStatus: row.salary_calculation_status,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
