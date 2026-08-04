import type { SQLiteDatabase } from 'expo-sqlite';

import { scheduledNotificationRecordSchema, type ScheduledNotificationRecord } from '@/domain/entities';
import type { ScheduledNotificationRepository, UpsertScheduledNotificationInput } from '@/domain/repositories';

function mapRow(row: Record<string, string | number | null>): ScheduledNotificationRecord {
  return scheduledNotificationRecordSchema.parse({
    logicalKey: row.logical_key,
    type: row.type,
    scheduledFor: row.scheduled_for,
    shiftId: row.shift_id ?? undefined,
    breakSessionId: row.break_session_id ?? undefined,
    workplaceId: row.workplace_id ?? undefined,
    titleKey: row.title_key,
    bodyKey: row.body_key,
    bodyParams: row.body_params_json ? JSON.parse(row.body_params_json as string) as Record<string, string | number> : undefined,
    nativeId: row.native_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteScheduledNotificationRepository implements ScheduledNotificationRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async listAll(): Promise<ScheduledNotificationRecord[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM scheduled_notification_records ORDER BY scheduled_for ASC;',
    );
    return rows.map(mapRow);
  }

  async listByShiftId(shiftId: string): Promise<ScheduledNotificationRecord[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM scheduled_notification_records WHERE shift_id = ? ORDER BY scheduled_for ASC;',
      [shiftId],
    );
    return rows.map(mapRow);
  }

  async getByLogicalKey(logicalKey: string): Promise<ScheduledNotificationRecord | null> {
    const row = await this.database.getFirstAsync<Record<string, string | number | null>>(
      'SELECT * FROM scheduled_notification_records WHERE logical_key = ?;',
      [logicalKey],
    );
    return row ? mapRow(row) : null;
  }

  async upsert(input: UpsertScheduledNotificationInput): Promise<void> {
    const now = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO scheduled_notification_records
        (logical_key, type, scheduled_for, shift_id, break_session_id, workplace_id,
         title_key, body_key, body_params_json, native_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(logical_key) DO UPDATE SET
         type = excluded.type,
         scheduled_for = excluded.scheduled_for,
         shift_id = excluded.shift_id,
         break_session_id = excluded.break_session_id,
         workplace_id = excluded.workplace_id,
         title_key = excluded.title_key,
         body_key = excluded.body_key,
         body_params_json = excluded.body_params_json,
         native_id = COALESCE(excluded.native_id, native_id),
         updated_at = excluded.updated_at;`,
      [
        input.logicalKey,
        input.type,
        input.scheduledFor,
        input.shiftId ?? null,
        input.breakSessionId ?? null,
        input.workplaceId ?? null,
        input.titleKey,
        input.bodyKey,
        input.bodyParams ? JSON.stringify(input.bodyParams) : null,
        input.nativeId ?? null,
        now,
        now,
      ],
    );
  }

  async deleteByLogicalKey(logicalKey: string): Promise<void> {
    await this.database.runAsync(
      'DELETE FROM scheduled_notification_records WHERE logical_key = ?;',
      [logicalKey],
    );
  }

  async deleteByShiftId(shiftId: string): Promise<void> {
    await this.database.runAsync(
      'DELETE FROM scheduled_notification_records WHERE shift_id = ?;',
      [shiftId],
    );
  }

  async updateNativeId(logicalKey: string, nativeId: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE scheduled_notification_records SET native_id = ?, updated_at = ? WHERE logical_key = ?;',
      [nativeId, new Date().toISOString(), logicalKey],
    );
  }
}
