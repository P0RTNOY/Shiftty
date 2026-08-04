import type { SQLiteDatabase } from 'expo-sqlite';

import { roleSchema, workplaceSchema, type Role, type Workplace } from '@/domain/entities';
import type { WorkplaceRepository } from '@/domain/repositories';

interface WorkplaceRow {
  id: string; name: string; address: string | null; default_hourly_rate_minor: number;
  default_break_minutes: number; salary_profile_id: string | null; color: string | null;
  default_travel_reimbursement_minor?: number; default_shift_bonus_minor?: number; is_archived?: number;
  created_at: string; updated_at: string;
}

export class SqliteWorkplaceRepository implements WorkplaceRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async list(): Promise<Workplace[]> {
    const rows = await this.database.getAllAsync<WorkplaceRow>('SELECT * FROM workplaces ORDER BY name COLLATE NOCASE;');
    return rows.map(mapWorkplace);
  }

  async getById(id: string): Promise<Workplace | null> {
    const row = await this.database.getFirstAsync<WorkplaceRow>('SELECT * FROM workplaces WHERE id = ?;', id);
    return row ? mapWorkplace(row) : null;
  }

  async save(input: Workplace): Promise<void> {
    const workplace = workplaceSchema.parse(input);
    await this.database.runAsync(
      `INSERT INTO workplaces (id, name, address, default_hourly_rate_minor, default_break_minutes, salary_profile_id, color, default_travel_reimbursement_minor, default_shift_bonus_minor, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, address=excluded.address,
       default_hourly_rate_minor=excluded.default_hourly_rate_minor,
       default_break_minutes=excluded.default_break_minutes, salary_profile_id=excluded.salary_profile_id,
       color=excluded.color, default_travel_reimbursement_minor=excluded.default_travel_reimbursement_minor,
       default_shift_bonus_minor=excluded.default_shift_bonus_minor, is_archived=excluded.is_archived,
       updated_at=excluded.updated_at;`,
      workplace.id, workplace.name, workplace.address ?? null, workplace.defaultHourlyRateMinor,
      workplace.defaultBreakMinutes, workplace.salaryProfileId ?? null, workplace.color ?? null,
      workplace.defaultTravelReimbursementMinor ?? 0, workplace.defaultShiftBonusMinor ?? 0, workplace.isArchived ? 1 : 0,
      workplace.createdAt, workplace.updatedAt,
    );
  }

  async listRoles(workplaceId: string): Promise<Role[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM roles WHERE workplace_id = ? ORDER BY name COLLATE NOCASE;', workplaceId,
    );
    return rows.map((row) => roleSchema.parse({
      id: row.id, workplaceId: row.workplace_id, name: row.name,
      hourlyRateMinor: row.hourly_rate_minor ?? undefined,
      isArchived: row.is_archived === 1,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async saveRole(input: Role): Promise<void> {
    const role = roleSchema.parse(input);
    const workplace = await this.getById(role.workplaceId);
    if (!workplace) throw new Error('Role workplace does not exist.');
    await this.database.runAsync(
      `INSERT INTO roles (id, workplace_id, name, hourly_rate_minor, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET workplace_id=excluded.workplace_id, name=excluded.name,
       hourly_rate_minor=excluded.hourly_rate_minor, is_archived=excluded.is_archived, updated_at=excluded.updated_at;`,
      role.id, role.workplaceId, role.name, role.hourlyRateMinor ?? null, role.isArchived ? 1 : 0, role.createdAt, role.updatedAt,
    );
  }
}

function mapWorkplace(row: WorkplaceRow): Workplace {
  return workplaceSchema.parse({
    id: row.id, name: row.name, address: row.address ?? undefined,
    defaultHourlyRateMinor: row.default_hourly_rate_minor,
    defaultBreakMinutes: row.default_break_minutes,
    salaryProfileId: row.salary_profile_id ?? undefined, color: row.color ?? undefined,
    defaultTravelReimbursementMinor: row.default_travel_reimbursement_minor ?? 0,
    defaultShiftBonusMinor: row.default_shift_bonus_minor ?? 0, isArchived: row.is_archived === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
}
