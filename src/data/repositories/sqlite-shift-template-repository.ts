import type { SQLiteDatabase } from 'expo-sqlite';

import { shiftTemplateSchema, type ShiftTemplate } from '@/domain/entities';
import type {
  ShiftTemplateRepository,
  CreateShiftTemplateInput,
  UpdateShiftTemplateInput,
} from '@/domain/repositories';
import { createId } from '@/shared/utils/id';
import { assertDefaultShiftDurationWithinLimit } from '@/domain/services/shift-duration-policy';

function mapRow(row: Record<string, string | number | null>): ShiftTemplate {
  return shiftTemplateSchema.parse({
    id: row.id,
    name: row.name,
    defaultStartTime: row.default_start_time,
    defaultEndTime: row.default_end_time,
    payMultiplierBasisPoints: row.pay_multiplier_basis_points,
    expectedBreakMinutes: row.expected_break_minutes,
    expectedBreakType: row.expected_break_type ?? undefined,
    validWeekdays: row.valid_weekdays
      ? JSON.parse(row.valid_weekdays as string) as number[]
      : undefined,
    expectedDurationMinutes: row.expected_duration_minutes ?? undefined,
    colorToken: row.color_token ?? undefined,
    isArchived: row.is_archived === 1,
    workplaceId: row.workplace_id ?? undefined,
    roleId: row.role_id ?? undefined,
    salaryProfileId: row.salary_profile_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteShiftTemplateRepository implements ShiftTemplateRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async list(): Promise<ShiftTemplate[]> {
    return this.listActive();
  }

  async listActive(): Promise<ShiftTemplate[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM shift_templates WHERE is_archived = 0 ORDER BY name COLLATE NOCASE;',
    );
    return rows.map(mapRow);
  }

  async listIncludingArchived(): Promise<ShiftTemplate[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM shift_templates ORDER BY is_archived ASC, name COLLATE NOCASE;',
    );
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<ShiftTemplate | null> {
    const row = await this.database.getFirstAsync<Record<string, string | number | null>>(
      'SELECT * FROM shift_templates WHERE id = ?;',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async create(input: CreateShiftTemplateInput): Promise<ShiftTemplate> {
    assertDefaultShiftDurationWithinLimit(input.defaultStartTime, input.defaultEndTime);
    const id = createId('template');
    const now = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO shift_templates (id, name, default_start_time, default_end_time, pay_multiplier_basis_points, expected_break_minutes,
        expected_break_type, valid_weekdays, expected_duration_minutes, color_token,
        workplace_id, role_id, salary_profile_id, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [
        id,
        input.name,
        input.defaultStartTime,
        input.defaultEndTime,
        input.payMultiplierBasisPoints ?? 10_000,
        input.expectedBreakMinutes,
        input.expectedBreakType ?? null,
        input.validWeekdays ? JSON.stringify(input.validWeekdays) : null,
        input.expectedDurationMinutes ?? null,
        input.colorToken ?? null,
        input.workplaceId ?? null,
        input.roleId ?? null,
        input.salaryProfileId ?? null,
        now,
        now,
      ],
    );
    return (await this.getById(id))!;
  }

  async update(id: string, input: UpdateShiftTemplateInput): Promise<ShiftTemplate> {
    if (input.defaultStartTime !== undefined || input.defaultEndTime !== undefined) {
      const current = await this.getById(id);
      if (!current) throw new Error(`Template ${id} not found.`);
      assertDefaultShiftDurationWithinLimit(
        input.defaultStartTime ?? current.defaultStartTime,
        input.defaultEndTime ?? current.defaultEndTime,
      );
    }
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.defaultStartTime !== undefined) { fields.push('default_start_time = ?'); values.push(input.defaultStartTime); }
    if (input.defaultEndTime !== undefined) { fields.push('default_end_time = ?'); values.push(input.defaultEndTime); }
    if (input.payMultiplierBasisPoints !== undefined) { fields.push('pay_multiplier_basis_points = ?'); values.push(input.payMultiplierBasisPoints); }
    if (input.expectedBreakMinutes !== undefined) { fields.push('expected_break_minutes = ?'); values.push(input.expectedBreakMinutes); }
    if ('expectedBreakType' in input) { fields.push('expected_break_type = ?'); values.push(input.expectedBreakType ?? null); }
    if ('validWeekdays' in input) { fields.push('valid_weekdays = ?'); values.push(input.validWeekdays ? JSON.stringify(input.validWeekdays) : null); }
    if ('expectedDurationMinutes' in input) { fields.push('expected_duration_minutes = ?'); values.push(input.expectedDurationMinutes ?? null); }
    if ('colorToken' in input) { fields.push('color_token = ?'); values.push(input.colorToken ?? null); }
    if ('workplaceId' in input) { fields.push('workplace_id = ?'); values.push(input.workplaceId ?? null); }
    if ('roleId' in input) { fields.push('role_id = ?'); values.push(input.roleId ?? null); }
    if ('salaryProfileId' in input) { fields.push('salary_profile_id = ?'); values.push(input.salaryProfileId ?? null); }

    values.push(id);
    await this.database.runAsync(`UPDATE shift_templates SET ${fields.join(', ')} WHERE id = ?;`, values);
    return (await this.getById(id))!;
  }

  async archive(id: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE shift_templates SET is_archived = 1, updated_at = ? WHERE id = ?;',
      [new Date().toISOString(), id],
    );
  }

  async restore(id: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE shift_templates SET is_archived = 0, updated_at = ? WHERE id = ?;',
      [new Date().toISOString(), id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      // Recurrence definitions are JSON snapshots and therefore are not covered by the SQL foreign key.
      // Remove only the live reference; the snapshotted type name and multiplier remain historical facts.
      await this.database.runAsync(
        `UPDATE recurrence_series
         SET template_json = json_remove(template_json, '$.shiftTemplateId'), updated_at = ?
         WHERE json_extract(template_json, '$.shiftTemplateId') = ?;`,
        [new Date().toISOString(), id],
      );
      await this.database.runAsync('DELETE FROM shift_templates WHERE id = ?;', [id]);
    });
  }

  async duplicate(id: string, newName: string): Promise<ShiftTemplate> {
    const source = await this.getById(id);
    if (!source) throw new Error(`Template ${id} not found.`);
    return this.create({
      name: newName,
      defaultStartTime: source.defaultStartTime,
      defaultEndTime: source.defaultEndTime,
      payMultiplierBasisPoints: source.payMultiplierBasisPoints ?? 10_000,
      expectedBreakMinutes: source.expectedBreakMinutes,
      expectedBreakType: source.expectedBreakType,
      validWeekdays: source.validWeekdays,
      expectedDurationMinutes: source.expectedDurationMinutes,
      colorToken: source.colorToken,
      workplaceId: source.workplaceId,
      roleId: source.roleId,
      salaryProfileId: source.salaryProfileId,
    });
  }
}
