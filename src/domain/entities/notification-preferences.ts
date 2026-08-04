import { z } from 'zod';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Reminder offsets in minutes before the shift start */
export const VALID_REMINDER_OFFSETS_MINUTES = [1440, 120, 60, 30, 15, 0] as const;
export type ReminderOffsetMinutes = (typeof VALID_REMINDER_OFFSETS_MINUTES)[number];

export const quietHoursSchema = z.object({
  startTime: localTimeSchema,
  endTime: localTimeSchema,
  /** Whether overdue active-shift reminders bypass quiet hours */
  allowActiveShiftBypass: z.boolean().default(true),
});
export type QuietHours = z.infer<typeof quietHoursSchema>;

export const notificationPreferencesSchema = z.object({
  /** Master switch — false disables ALL notifications */
  masterEnabled: z.boolean().default(true),
  scheduledShiftReminders: z.boolean().default(true),
  /** Offsets (in minutes before start) to schedule shift reminders */
  shiftReminderOffsets: z
    .array(z.number().int().min(0).max(1440))
    .default([60, 15]),
  missedClockInReminders: z.boolean().default(true),
  /** Grace period in minutes after scheduled start before missed-clock-in fires */
  missedClockInGraceMinutes: z.number().int().min(0).max(120).default(10),
  expectedEndReminders: z.boolean().default(true),
  overdueShiftReminders: z.boolean().default(true),
  longBreakReminders: z.boolean().default(true),
  /** Unpaid break threshold in minutes */
  longUnpaidBreakThresholdMinutes: z.number().int().min(0).max(240).default(30),
  /** Paid break threshold in minutes */
  longPaidBreakThresholdMinutes: z.number().int().min(0).max(240).default(60),
  dailySummaryEnabled: z.boolean().default(false),
  /** Local time (HH:mm) to send daily summary */
  dailySummaryTime: localTimeSchema.default('20:00'),
  quietHours: quietHoursSchema.optional(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const workplaceNotificationOverrideSchema = z.object({
  workplaceId: z.string().min(1),
  /** null = inherit from global */
  scheduledShiftReminders: z.boolean().nullish(),
  shiftReminderOffsets: z.array(z.number().int().min(0).max(1440)).nullish(),
  missedClockInReminders: z.boolean().nullish(),
  missedClockInGraceMinutes: z.number().int().min(0).max(120).nullish(),
  expectedEndReminders: z.boolean().nullish(),
  overdueShiftReminders: z.boolean().nullish(),
  longBreakReminders: z.boolean().nullish(),
  longUnpaidBreakThresholdMinutes: z.number().int().min(0).max(240).nullish(),
  longPaidBreakThresholdMinutes: z.number().int().min(0).max(240).nullish(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type WorkplaceNotificationOverride = z.infer<typeof workplaceNotificationOverrideSchema>;

/** Resolved preferences for a specific workplace (global merged with override) */
export interface ResolvedNotificationPreferences {
  masterEnabled: boolean;
  scheduledShiftReminders: boolean;
  shiftReminderOffsets: number[];
  missedClockInReminders: boolean;
  missedClockInGraceMinutes: number;
  expectedEndReminders: boolean;
  overdueShiftReminders: boolean;
  longBreakReminders: boolean;
  longUnpaidBreakThresholdMinutes: number;
  longPaidBreakThresholdMinutes: number;
  quietHours?: QuietHours;
}

export function resolveNotificationPreferences(
  global: NotificationPreferences,
  override: WorkplaceNotificationOverride | null,
): ResolvedNotificationPreferences {
  const o = override;
  return {
    masterEnabled: global.masterEnabled,
    scheduledShiftReminders: o?.scheduledShiftReminders ?? global.scheduledShiftReminders,
    shiftReminderOffsets: o?.shiftReminderOffsets ?? global.shiftReminderOffsets,
    missedClockInReminders: o?.missedClockInReminders ?? global.missedClockInReminders,
    missedClockInGraceMinutes: o?.missedClockInGraceMinutes ?? global.missedClockInGraceMinutes,
    expectedEndReminders: o?.expectedEndReminders ?? global.expectedEndReminders,
    overdueShiftReminders: o?.overdueShiftReminders ?? global.overdueShiftReminders,
    longBreakReminders: o?.longBreakReminders ?? global.longBreakReminders,
    longUnpaidBreakThresholdMinutes:
      o?.longUnpaidBreakThresholdMinutes ?? global.longUnpaidBreakThresholdMinutes,
    longPaidBreakThresholdMinutes:
      o?.longPaidBreakThresholdMinutes ?? global.longPaidBreakThresholdMinutes,
    quietHours: global.quietHours,
  };
}
