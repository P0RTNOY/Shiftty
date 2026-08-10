import { useMemo, useCallback } from 'react';
import { Platform } from 'react-native';

import { NotificationReconciler } from '@/features/shifts/notifications/notification-reconciler';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useTranslation } from '@/shared/i18n';
import type { Shift, BreakSession } from '@/domain/entities';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';

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

  const reconcileAll = useCallback(async (
    now: Date,
    activeShiftOverride?: Shift | null,
    activeBreakOverride?: BreakSession | null,
  ) => {
    const activeShift = activeShiftOverride === undefined
      ? await repositories.activeShifts.getActiveShift()
      : activeShiftOverride;
    const activeBreak = activeBreakOverride === undefined
      ? (activeShift ? (await repositories.activeShifts.listBreaks(activeShift.id)).find((item) => !item.end) ?? null : null)
      : activeBreakOverride;
    const upcomingShifts = await repositories.shifts.listUpcoming(now.toISOString(), 50);
    const timezone = activeShift?.timezone ?? upcomingShifts[0]?.timezone ?? DEFAULT_TIMEZONE;

    await reconciler.reconcile({
      now,
      timezone,
      upcomingShifts,
      activeShift,
      activeBreak,
      workplaceId: activeShift?.workplaceId,
    });
  }, [reconciler, repositories.activeShifts, repositories.shifts]);

  const reconcileActiveShift = useCallback(async (
    activeShift: Shift | null,
    activeBreak: BreakSession | null,
    now: Date,
  ) => reconcileAll(now, activeShift, activeBreak), [reconcileAll]);

  const cancelForShift = useCallback(async (shiftId: string) => reconciler.cancelForShift(shiftId), [reconciler]);

  return { reconciler, reconcileAll, reconcileActiveShift, cancelForShift };
}
