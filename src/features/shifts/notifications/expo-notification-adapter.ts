/**
 * Expo Notification Adapter
 *
 * Wraps expo-notifications to allow testing without native delivery.
 * Web platform uses a no-op implementation.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export interface NotificationAdapter {
  getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  scheduleNotification(logicalKey: string, scheduledFor: Date, titleKey: string, bodyKey: string, bodyParams: Record<string, string | number>, data: Record<string, unknown>): Promise<string | null>;
  cancelNotification(nativeId: string): Promise<void>;
  cancelAllByOwner(owner: string): Promise<void>;
}

class ExpoNotificationAdapter implements NotificationAdapter {
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (Platform.OS === 'web') return 'undetermined';
    const { status } = await Notifications.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  }

  async requestPermission(): Promise<'granted' | 'denied'> {
    if (Platform.OS === 'web') return 'denied';
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  }

  async scheduleNotification(
    logicalKey: string,
    scheduledFor: Date,
    titleKey: string,
    bodyKey: string,
    bodyParams: Record<string, string | number>,
    data: Record<string, unknown>,
  ): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    return Notifications.scheduleNotificationAsync({
      content: {
        title: titleKey, // Caller resolves i18n before passing
        body: bodyKey,
        data: { ...data, logicalKey, bodyParams },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledFor,
      },
    });
  }

  async cancelNotification(nativeId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    await Notifications.cancelScheduledNotificationAsync(nativeId);
  }

  async cancelAllByOwner(owner: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.owner === owner)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch((error: unknown) => {
          reportUnexpectedError('notifications.cancelAll', error);
        })),
    );
  }
}

class NoOpNotificationAdapter implements NotificationAdapter {
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> { return 'undetermined'; }
  async requestPermission(): Promise<'granted' | 'denied'> { return 'denied'; }
  async scheduleNotification(): Promise<string | null> { return null; }
  async cancelNotification(): Promise<void> {}
  async cancelAllByOwner(): Promise<void> {}
}

export const expoNotificationAdapter: NotificationAdapter = new ExpoNotificationAdapter();
export const noOpNotificationAdapter: NotificationAdapter = new NoOpNotificationAdapter();
