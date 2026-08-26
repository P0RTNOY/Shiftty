import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'DATE' },
}));

describe('ExpoNotificationAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('on native platforms', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('getPermissionStatus returns status from expo', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
      const status = await expoNotificationAdapter.getPermissionStatus();
      expect(status).toBe('granted');
    });

    it('scheduleNotification calls expo and returns id', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('native-1');
      const id = await expoNotificationAdapter.scheduleNotification(
        'key', new Date(), 'title', 'body', {}, {}
      );
      expect(id).toBe('native-1');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('lists native scheduled notification identifiers', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'native-1', content: { data: {} } },
        { identifier: 'native-2', content: { data: {} } },
      ]);

      await expect(expoNotificationAdapter.listScheduledNotificationIds()).resolves.toEqual(
        new Set(['native-1', 'native-2']),
      );
    });

    it('propagates native scheduling failures to the reconciler', async () => {
      const nativeError = new Error('schedule failed');
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(nativeError);

      await expect(expoNotificationAdapter.scheduleNotification('key', new Date(), 'title', 'body', {}, {})).rejects.toBe(nativeError);
    });

    it('cancelNotification calls expo', async () => {
      await expoNotificationAdapter.cancelNotification('native-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('native-1');
    });

    it('propagates native cancellation failures to the reconciler', async () => {
      const nativeError = new Error('cancel failed');
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValueOnce(nativeError);

      await expect(expoNotificationAdapter.cancelNotification('native-1')).rejects.toBe(nativeError);
    });

    it('cancelAllByOwner fetches and filters', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'id1', content: { data: { owner: 'shifty' } } },
        { identifier: 'id2', content: { data: { owner: 'other' } } },
      ]);
      await expoNotificationAdapter.cancelAllByOwner('shifty');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('id2');
    });
  });

  describe('on web platform', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('getPermissionStatus returns undetermined', async () => {
      const status = await expoNotificationAdapter.getPermissionStatus();
      expect(status).toBe('undetermined');
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it('scheduleNotification returns null', async () => {
      const id = await expoNotificationAdapter.scheduleNotification('key', new Date(), 'title', 'body', {}, {});
      expect(id).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns no native scheduled IDs', async () => {
      await expect(expoNotificationAdapter.listScheduledNotificationIds()).resolves.toEqual(new Set());
      expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    });
  });
});

describe('NoOpNotificationAdapter', () => {
  it('returns safe default values', async () => {
    expect(await noOpNotificationAdapter.getPermissionStatus()).toBe('undetermined');
    expect(await noOpNotificationAdapter.requestPermission()).toBe('denied');
    expect(await noOpNotificationAdapter.listScheduledNotificationIds()).toEqual(new Set());
    expect(await noOpNotificationAdapter.scheduleNotification('key', new Date(), 'title', 'body', {}, {})).toBeNull();
  });
});
