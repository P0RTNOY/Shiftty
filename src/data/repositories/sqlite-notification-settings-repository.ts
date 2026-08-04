import type { SQLiteDatabase } from 'expo-sqlite';

import {
  notificationPreferencesSchema,
  workplaceNotificationOverrideSchema,
  type NotificationPreferences,
  type WorkplaceNotificationOverride,
} from '@/domain/entities';
import type { NotificationSettingsRepository } from '@/domain/repositories';

const GLOBAL_PREFS_KEY = 'notification_preferences_v1';

const DEFAULT_PREFERENCES: NotificationPreferences = notificationPreferencesSchema.parse({});

export class SqliteNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getGlobal(): Promise<NotificationPreferences> {
    const row = await this.database.getFirstAsync<{ value_json: string }>(
      "SELECT value_json FROM app_settings WHERE key = ?;",
      [GLOBAL_PREFS_KEY],
    );
    if (!row) return DEFAULT_PREFERENCES;
    try {
      return notificationPreferencesSchema.parse(JSON.parse(row.value_json));
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async updateGlobal(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const parsed = notificationPreferencesSchema.parse(preferences);
    const now = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at;`,
      [GLOBAL_PREFS_KEY, JSON.stringify(parsed), now],
    );
    return parsed;
  }

  async getWorkplaceOverride(workplaceId: string): Promise<WorkplaceNotificationOverride | null> {
    const row = await this.database.getFirstAsync<Record<string, string | number | null>>(
      'SELECT * FROM workplace_notification_overrides WHERE workplace_id = ?;',
      [workplaceId],
    );
    if (!row) return null;
    return mapOverrideRow(row);
  }

  async updateWorkplaceOverride(override: WorkplaceNotificationOverride): Promise<void> {
    const now = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO workplace_notification_overrides
        (workplace_id, scheduled_shift_reminders, shift_reminder_offsets_json,
         missed_clock_in_reminders, missed_clock_in_grace_minutes, expected_end_reminders,
         overdue_shift_reminders, long_break_reminders, long_unpaid_break_threshold_minutes,
         long_paid_break_threshold_minutes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workplace_id) DO UPDATE SET
         scheduled_shift_reminders = excluded.scheduled_shift_reminders,
         shift_reminder_offsets_json = excluded.shift_reminder_offsets_json,
         missed_clock_in_reminders = excluded.missed_clock_in_reminders,
         missed_clock_in_grace_minutes = excluded.missed_clock_in_grace_minutes,
         expected_end_reminders = excluded.expected_end_reminders,
         overdue_shift_reminders = excluded.overdue_shift_reminders,
         long_break_reminders = excluded.long_break_reminders,
         long_unpaid_break_threshold_minutes = excluded.long_unpaid_break_threshold_minutes,
         long_paid_break_threshold_minutes = excluded.long_paid_break_threshold_minutes,
         updated_at = excluded.updated_at;`,
      [
        override.workplaceId,
        override.scheduledShiftReminders == null ? null : override.scheduledShiftReminders ? 1 : 0,
        override.shiftReminderOffsets != null ? JSON.stringify(override.shiftReminderOffsets) : null,
        override.missedClockInReminders == null ? null : override.missedClockInReminders ? 1 : 0,
        override.missedClockInGraceMinutes ?? null,
        override.expectedEndReminders == null ? null : override.expectedEndReminders ? 1 : 0,
        override.overdueShiftReminders == null ? null : override.overdueShiftReminders ? 1 : 0,
        override.longBreakReminders == null ? null : override.longBreakReminders ? 1 : 0,
        override.longUnpaidBreakThresholdMinutes ?? null,
        override.longPaidBreakThresholdMinutes ?? null,
        now,
      ],
    );
  }

  async clearWorkplaceOverride(workplaceId: string): Promise<void> {
    await this.database.runAsync(
      'DELETE FROM workplace_notification_overrides WHERE workplace_id = ?;',
      [workplaceId],
    );
  }
}

function mapOverrideRow(row: Record<string, string | number | null>): WorkplaceNotificationOverride {
  return workplaceNotificationOverrideSchema.parse({
    workplaceId: row.workplace_id,
    scheduledShiftReminders: row.scheduled_shift_reminders == null ? undefined : row.scheduled_shift_reminders === 1,
    shiftReminderOffsets: row.shift_reminder_offsets_json
      ? JSON.parse(row.shift_reminder_offsets_json as string) as number[]
      : undefined,
    missedClockInReminders: row.missed_clock_in_reminders == null ? undefined : row.missed_clock_in_reminders === 1,
    missedClockInGraceMinutes: row.missed_clock_in_grace_minutes ?? undefined,
    expectedEndReminders: row.expected_end_reminders == null ? undefined : row.expected_end_reminders === 1,
    overdueShiftReminders: row.overdue_shift_reminders == null ? undefined : row.overdue_shift_reminders === 1,
    longBreakReminders: row.long_break_reminders == null ? undefined : row.long_break_reminders === 1,
    longUnpaidBreakThresholdMinutes: row.long_unpaid_break_threshold_minutes ?? undefined,
    longPaidBreakThresholdMinutes: row.long_paid_break_threshold_minutes ?? undefined,
    updatedAt: row.updated_at as string,
  });
}
