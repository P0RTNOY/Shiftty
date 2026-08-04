import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'shift_reminder',
  'missed_clock_in',
  'expected_end_soon',
  'expected_end',
  'overdue_shift',
  'long_break',
  'daily_summary',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * A stable logical identifier for a notification.
 * Built from type + shiftId (+ offset or other qualifier).
 * Used for deduplication and reconciliation.
 */
export const scheduledNotificationRecordSchema = z.object({
  logicalKey: z.string().min(1),
  type: notificationTypeSchema,
  scheduledFor: z.string().datetime({ offset: true }),
  shiftId: z.string().min(1).optional(),
  breakSessionId: z.string().min(1).optional(),
  workplaceId: z.string().min(1).optional(),
  titleKey: z.string().min(1),
  bodyKey: z.string().min(1),
  bodyParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  /** Native notification identifier returned by Expo after scheduling */
  nativeId: z.string().min(1).optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type ScheduledNotificationRecord = z.infer<typeof scheduledNotificationRecordSchema>;

export interface PlannedNotification {
  logicalKey: string;
  type: NotificationType;
  scheduledFor: string;
  shiftId?: string;
  breakSessionId?: string;
  workplaceId?: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
}

export interface NotificationPlan {
  notifications: PlannedNotification[];
  /** logical keys of notifications that should be cancelled */
  cancellations: string[];
}
