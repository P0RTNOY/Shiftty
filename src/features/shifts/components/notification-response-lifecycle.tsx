import { useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteShiftRepository } from '@/data/repositories';
import { createNotificationResponseRouter } from '@/features/shifts/notifications/notification-response-router';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export function NotificationResponseLifecycle() {
  const database = useSQLiteContext();
  const shifts = useMemo(() => new SqliteShiftRepository(database), [database]);

  useEffect(() => {
    const handleResponse = createNotificationResponseRouter({
      shifts,
      navigation: {
        openShift: (shiftId) => router.replace(`/shifts/${encodeURIComponent(shiftId)}`),
        openCalendar: () => router.replace('/calendar'),
      },
      clearLastResponse: () => Notifications.clearLastNotificationResponseAsync(),
      reportError: (error) => reportUnexpectedError('notifications.response', error),
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => response ? handleResponse(response) : undefined)
      .catch((error: unknown) => reportUnexpectedError('notifications.response.bootstrap', error));

    return () => subscription.remove();
  }, [shifts]);

  return null;
}
