import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';

import { useNotificationReconciler } from '@/features/shifts/hooks/use-notification-reconciler';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export function NotificationLifecycle() {
  const pathname = usePathname();
  const { reconcileAll } = useNotificationReconciler();

  useEffect(() => {
    void reconcileAll(new Date()).catch((error: unknown) => {
      reportUnexpectedError('notifications.lifecycle', error);
    });
  }, [pathname, reconcileAll]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void reconcileAll(new Date()).catch((error: unknown) => {
          reportUnexpectedError('notifications.lifecycle', error);
        });
      }
    });
    return () => subscription.remove();
  }, [reconcileAll]);

  return null;
}
