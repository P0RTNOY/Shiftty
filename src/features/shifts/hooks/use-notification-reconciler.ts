import { useMemo, useCallback } from 'react';
import { Platform } from 'react-native';

import { NotificationReconciler } from '@/features/shifts/notifications/notification-reconciler';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useTranslation } from '@/shared/i18n';
import type { Shift, BreakSession } from '@/domain/entities';

const adapter = Platform.OS === 'web' ? noOpNotificationAdapter : expoNotificationAdapter;

export function useNotificationReconciler() {
  const repositories = useRepositories();
  const { t } = useTranslation();

  const resolveText = useCallback((key: string, params?: Record<string, string | number>) => {
    return t(key as any, params);
  }, [t]);

  const reconciler = useMemo(() => {
    return new NotificationReconciler(
      repositories.notificationSettings,
      repositories.scheduledNotifications,
      adapter,
      resolveText
    );
  }, [repositories, resolveText]);

  const reconcileActiveShift = useCallback(async (
    activeShift: Shift | null,
    activeBreak: BreakSession | null,
    now: Date
  ) => {
    try {
      // In a real app we'd also pass upcomingShifts, but this is scoped to active shift updates.
      // We pass empty array for upcomingShifts so they don't get accidentally cancelled if we don't load them.
      // Wait, the reconciler deletes obsolete keys based on the plan. If we pass empty upcoming shifts,
      // it will cancel ALL upcoming shift reminders!
      // This means we must fetch upcoming shifts, OR adjust the reconciler.
      // Fetch upcoming shifts (next 24 hours is safe)
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const upcomingShifts = await repositories.shifts.list({
        statuses: ['scheduled'],
        endsAfter: now.toISOString(),
        startsBefore: windowEnd,
      });

      const timezone = activeShift?.timezone ?? 'Asia/Jerusalem';

      await reconciler.reconcile({
        now,
        timezone,
        upcomingShifts,
        activeShift,
        activeBreak,
        workplaceId: activeShift?.workplaceId,
      });
    } catch (err) {
      // Avoid crashing the app if reconciliation fails
      console.warn('Reconciliation failed:', err);
    }
  }, [reconciler, repositories.shifts]);

  const cancelForShift = useCallback(async (shiftId: string) => {
    try {
      await reconciler.cancelForShift(shiftId);
    } catch (err) {
      console.warn('Failed to cancel notifications for shift:', err);
    }
  }, [reconciler]);

  return { reconciler, reconcileActiveShift, cancelForShift };
}
