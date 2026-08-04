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

    it('cancelNotification calls expo', async () => {
      await expoNotificationAdapter.cancelNotification('native-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('native-1');
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
  });
});

describe('NoOpNotificationAdapter', () => {
  it('returns safe default values', async () => {
    expect(await noOpNotificationAdapter.getPermissionStatus()).toBe('undetermined');
    expect(await noOpNotificationAdapter.requestPermission()).toBe('denied');
    expect(await noOpNotificationAdapter.scheduleNotification('key', new Date(), 'title', 'body', {}, {})).toBeNull();
  });
});
