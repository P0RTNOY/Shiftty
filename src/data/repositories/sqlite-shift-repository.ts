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
  scheduled_start: string;
  scheduled_end: string;
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
  recurrence_group_id: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

const SHIFT_COLUMNS = `
  id, workplace_id, role_id, salary_profile_id, title, notes,
  scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end,
  expected_break_minutes, actual_break_minutes, payable_break_minutes, status,
  hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor,
  payable_gross_pay_minor, recurrence_group_id, timezone, created_at, updated_at
`;

export class SqliteShiftRepository implements ShiftRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getById(id: string): Promise<Shift | null> {
    const row = await this.database.getFirstAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = ?;`,
      id,
    );
    return row ? mapRow(row) : null;
  }

  async findActive(): Promise<Shift | null> {
    const row = await this.database.getFirstAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE status = 'active' LIMIT 1;`,
    );
    return row ? mapRow(row) : null;
  }

  async list(query: ShiftQuery = {}): Promise<Shift[]> {
    const clauses: string[] = [];
    const parameters: SQLiteBindValue[] = [];

    if (query.startsBefore) {
      clauses.push('scheduled_start < ?');
      parameters.push(query.startsBefore);
    }
    if (query.endsAfter) {
      clauses.push('scheduled_end > ?');
      parameters.push(query.endsAfter);
    }
    if (query.workplaceId) {
      clauses.push('workplace_id = ?');
      parameters.push(query.workplaceId);
    }
    if (query.statuses?.length) {
      clauses.push(`status IN (${query.statuses.map(() => '?').join(', ')})`);
      parameters.push(...query.statuses);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.database.getAllAsync<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts ${where} ORDER BY scheduled_start ASC;`,
      ...parameters,
    );
    return rows.map(mapRow);
  }

  async save(input: Shift): Promise<void> {
    const shift = shiftSchema.parse(input);
    await this.database.runAsync(
      `
        INSERT INTO shifts (
          ${SHIFT_COLUMNS}
        ) VALUES (${Array.from({ length: 24 }, () => '?').join(', ')})
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
          recurrence_group_id = excluded.recurrence_group_id,
          timezone = excluded.timezone,
          updated_at = excluded.updated_at;
      `,
      ...toParameters(shift),
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM shifts WHERE id = ?;', id);
  }
}

function toParameters(shift: Shift): SQLiteBindValue[] {
  return [
    shift.id,
    shift.workplaceId,
    shift.roleId ?? null,
    shift.salaryProfileId ?? null,
    shift.title ?? null,
    shift.notes ?? null,
    shift.scheduledStart,
    shift.scheduledEnd,
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
    shift.recurrenceGroupId ?? null,
    shift.timezone,
    shift.createdAt,
    shift.updatedAt,
  ];
}

function mapRow(row: ShiftRow): Shift {
  return shiftSchema.parse({
    id: row.id,
    workplaceId: row.workplace_id,
    roleId: row.role_id ?? undefined,
    salaryProfileId: row.salary_profile_id ?? undefined,
    title: row.title ?? undefined,
    notes: row.notes ?? undefined,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
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
    recurrenceGroupId: row.recurrence_group_id ?? undefined,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
