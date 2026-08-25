/**
 * Notification Reconciler
 *
 * Orchestrates the diff-and-sync between:
 * - Desired plan (from notification-planner)
 * - Persisted metadata (from ScheduledNotificationRepository)
 * - Native notification system (via NotificationAdapter)
 *
 * Algorithm:
 * 1. Compute desired plan
 * 2. Load persisted records
 * 3. Cancel obsolete native notifications and delete their records
 * 4. Schedule new/changed notifications
 * 5. Persist new records with native IDs
 *
 * Native scheduling failure does NOT corrupt shift data.
 * Reconciliation is idempotent.
 */

import type { Shift, BreakSession } from '@/domain/entities';
import type { ScheduledNotificationRepository } from '@/domain/repositories';
import type { NotificationSettingsRepository } from '@/domain/repositories/notification-settings-repository';
import { resolveNotificationPreferences } from '@/domain/entities/notification-preferences';
import { buildNotificationPlan } from '@/domain/services/notification-planner';
import type { NotificationAdapter } from './expo-notification-adapter';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

// Native notification state is process-global. Reconciliation can be requested by
// navigation, foregrounding, and an active-shift mutation at nearly the same time,
// sometimes through different hook instances. Serializing those mutations prevents
// both callers from observing the same stale repository snapshot and scheduling two
// native notifications for one logical key.
let notificationMutationTail: Promise<void> = Promise.resolve();

function runNotificationMutation(operation: () => Promise<void>): Promise<void> {
  const result = notificationMutationTail.then(operation, operation);
  notificationMutationTail = result.catch(() => undefined);
  return result;
}

export interface ReconcileInput {
  now: Date;
  timezone: string;
  upcomingShifts: readonly Shift[];
  activeShift: Shift | null;
  activeBreak: BreakSession | null;
  workplaceId?: string;
}

export class NotificationReconciler {
  constructor(
    private readonly notifSettings: NotificationSettingsRepository,
    private readonly scheduledNotifs: ScheduledNotificationRepository,
    private readonly adapter: NotificationAdapter,
    private readonly resolveText: (key: string, params?: Record<string, string | number>) => string,
  ) {}

  reconcile(input: ReconcileInput): Promise<void> {
    return runNotificationMutation(() => this.reconcileExclusive(input));
  }

  private async reconcileExclusive(input: ReconcileInput): Promise<void> {
    // Check permission first
    const permission = await this.adapter.getPermissionStatus();
    if (permission !== 'granted') {
      return; // Core functionality unaffected
    }

    // Load preferences
    const globalPrefs = await this.notifSettings.getGlobal();
    const workplaceIds = new Set(input.upcomingShifts.map((shift) => shift.workplaceId));
    if (input.activeShift) workplaceIds.add(input.activeShift.workplaceId);
    if (input.workplaceId) workplaceIds.add(input.workplaceId);
    const overrideEntries = await Promise.all([...workplaceIds].map(async (workplaceId) => [
      workplaceId,
      await this.notifSettings.getWorkplaceOverride(workplaceId),
    ] as const));
    const preferencesByWorkplace = new Map(overrideEntries.map(([workplaceId, override]) => [
      workplaceId,
      resolveNotificationPreferences(globalPrefs, override),
    ] as const));
    const resolved = resolveNotificationPreferences(globalPrefs, null);

    // Load existing records
    const existingRecords = await this.scheduledNotifs.listAll();

    // Build plan
    const plan = buildNotificationPlan({
      now: input.now,
      timezone: input.timezone,
      upcomingShifts: input.upcomingShifts,
      activeShift: input.activeShift,
      activeBreak: input.activeBreak,
      preferences: resolved,
      preferencesByWorkplace,
      existingRecords,
    });

    // Cancel obsolete notifications
    const existingByKey = new Map(existingRecords.map((r) => [r.logicalKey, r]));
    for (const logicalKey of plan.cancellations) {
      const record = existingByKey.get(logicalKey);
      if (record?.nativeId) {
        await this.adapter.cancelNotification(record.nativeId).catch((error: unknown) => {
          reportUnexpectedError('notifications.cancel', error);
        });
      }
      await this.scheduledNotifs.deleteByLogicalKey(logicalKey);
    }

    // Schedule new/changed notifications
    for (const notification of plan.notifications) {
      const scheduledFor = new Date(notification.scheduledFor);
      if (scheduledFor <= input.now) continue; // Safety: skip past notifications

      // Cancel existing native notification for this key before rescheduling
      const existing = existingByKey.get(notification.logicalKey);
      if (existing?.nativeId) {
        await this.adapter.cancelNotification(existing.nativeId).catch((error: unknown) => {
          reportUnexpectedError('notifications.cancel', error);
        });
      }

      // Resolve translated text
      const title = this.resolveText(notification.titleKey, notification.bodyParams);
      const body = this.resolveText(notification.bodyKey, notification.bodyParams);

      // Persist record first (so we don't lose track even if scheduling fails)
      await this.scheduledNotifs.upsert({
        logicalKey: notification.logicalKey,
        type: notification.type,
        scheduledFor: notification.scheduledFor,
        shiftId: notification.shiftId,
        breakSessionId: notification.breakSessionId,
        workplaceId: notification.workplaceId,
        titleKey: notification.titleKey,
        bodyKey: notification.bodyKey,
        bodyParams: notification.bodyParams,
      });

      // Schedule native notification
      try {
        const nativeId = await this.adapter.scheduleNotification(
          notification.logicalKey,
          scheduledFor,
          title,
          body,
          notification.bodyParams ?? {},
          { owner: 'shifty', logicalKey: notification.logicalKey, shiftId: notification.shiftId },
        );
        if (nativeId) {
          await this.scheduledNotifs.updateNativeId(notification.logicalKey, nativeId);
        }
      } catch (error) {
        reportUnexpectedError('notifications.schedule', error);
        // Scheduling failure does not corrupt data
      }
    }
  }

  cancelForShift(shiftId: string): Promise<void> {
    return runNotificationMutation(() => this.cancelForShiftExclusive(shiftId));
  }

  private async cancelForShiftExclusive(shiftId: string): Promise<void> {
    const records = await this.scheduledNotifs.listByShiftId(shiftId);
    for (const record of records) {
      if (record.nativeId) {
        await this.adapter.cancelNotification(record.nativeId).catch((error: unknown) => {
          reportUnexpectedError('notifications.cancel', error);
        });
      }
    }
    await this.scheduledNotifs.deleteByShiftId(shiftId);
  }
}
