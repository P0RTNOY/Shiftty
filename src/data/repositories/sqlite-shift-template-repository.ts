import type { SQLiteDatabase } from 'expo-sqlite';

import { shiftTemplateSchema, type ShiftTemplate } from '@/domain/entities';
import type { ShiftTemplateRepository } from '@/domain/repositories';

export class SqliteShiftTemplateRepository implements ShiftTemplateRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async list(): Promise<ShiftTemplate[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>('SELECT * FROM shift_templates ORDER BY name COLLATE NOCASE;');
    return rows.map((row) => shiftTemplateSchema.parse({
      id: row.id, name: row.name, defaultStartTime: row.default_start_time, defaultEndTime: row.default_end_time,
      expectedBreakMinutes: row.expected_break_minutes, workplaceId: row.workplace_id ?? undefined,
      roleId: row.role_id ?? undefined, salaryProfileId: row.salary_profile_id ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }
}
