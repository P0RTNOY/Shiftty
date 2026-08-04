import { NotificationReconciler } from '@/features/shifts/notifications/notification-reconciler';
import type { NotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import type { ScheduledNotificationRepository, NotificationSettingsRepository } from '@/domain/repositories';
import type { Shift } from '@/domain/entities';

const TIMEZONE = 'Asia/Jerusalem';

describe('NotificationReconciler', () => {
  let settingsRepo: jest.Mocked<NotificationSettingsRepository>;
  let scheduledRepo: jest.Mocked<ScheduledNotificationRepository>;
  let adapter: jest.Mocked<NotificationAdapter>;
  let resolveText: jest.Mock;
  let reconciler: NotificationReconciler;

  beforeEach(() => {
    settingsRepo = {
      getGlobal: jest.fn(),
      updateGlobal: jest.fn(),
      getWorkplaceOverride: jest.fn(),
      updateWorkplaceOverride: jest.fn(),
      clearWorkplaceOverride: jest.fn(),
    };
    scheduledRepo = {
      listAll: jest.fn(),
      listByShiftId: jest.fn(),
      getByLogicalKey: jest.fn(),
      upsert: jest.fn(),
      deleteByLogicalKey: jest.fn().mockResolvedValue(undefined),
      deleteByShiftId: jest.fn().mockResolvedValue(undefined),
      updateNativeId: jest.fn(),
    };
    adapter = {
      getPermissionStatus: jest.fn(),
      requestPermission: jest.fn(),
      scheduleNotification: jest.fn(),
      cancelNotification: jest.fn().mockResolvedValue(undefined),
      cancelAllByOwner: jest.fn().mockResolvedValue(undefined),
    };
    resolveText = jest.fn((key) => key);
    reconciler = new NotificationReconciler(settingsRepo, scheduledRepo, adapter, resolveText);
  });

  it('bails early if permission is denied', async () => {
    adapter.getPermissionStatus.mockResolvedValue('denied');
    await reconciler.reconcile({
      now: new Date(),
      timezone: TIMEZONE,
      upcomingShifts: [],
      activeShift: null,
      activeBreak: null,
    });
    expect(settingsRepo.getGlobal).not.toHaveBeenCalled();
  });

  it('cancels obsolete notifications and schedules new ones', async () => {
    adapter.getPermissionStatus.mockResolvedValue('granted');
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true,
      scheduledShiftReminders: true,
      shiftReminderOffsets: [60],
      missedClockInReminders: false,
      expectedEndReminders: false,
      overdueShiftReminders: false,
      longBreakReminders: false,
      missedClockInGraceMinutes: 15,
      longUnpaidBreakThresholdMinutes: 30,
      longPaidBreakThresholdMinutes: 15,
      dailySummaryEnabled: false,
      dailySummaryTime: '20:00',
    });
    settingsRepo.getWorkplaceOverride.mockResolvedValue(null);

    // Mock an existing notification that is now obsolete (different offset or shift)
    scheduledRepo.listAll.mockResolvedValue([{
      logicalKey: 'shift_reminder:old:60',
      type: 'shift_reminder',
      scheduledFor: '2026-08-04T09:00:00Z',
      nativeId: 'native-old',
      titleKey: '',
      bodyKey: '',
      createdAt: '',
      updatedAt: '',
    }]);

    const upcomingShift: Shift = {
      id: 'new-shift',
      status: 'scheduled',
      scheduledStart: '2026-08-04T12:00:00+03:00',
      scheduledEnd: '2026-08-04T16:00:00+03:00',
      workplaceId: 'wp-1',
      expectedBreakMinutes: 0,
      hourlyRateSnapshotMinor: 0,
      salaryCalculationStatus: 'not_calculated',
      timezone: TIMEZONE,
      createdAt: '',
      updatedAt: '',
    };

    adapter.scheduleNotification.mockResolvedValue('native-new');

    await reconciler.reconcile({
      now: new Date('2026-08-04T10:00:00+03:00'),
      timezone: TIMEZONE,
      upcomingShifts: [upcomingShift],
      activeShift: null,
      activeBreak: null,
    });

    // It should cancel the obsolete notification natively and from DB
    expect(adapter.cancelNotification).toHaveBeenCalledWith('native-old');
    expect(scheduledRepo.deleteByLogicalKey).toHaveBeenCalledWith('shift_reminder:old:60');

    // It should schedule the new one
    expect(scheduledRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      logicalKey: 'shift_reminder:new-shift:60',
    }));
    expect(adapter.scheduleNotification).toHaveBeenCalled();
    expect(scheduledRepo.updateNativeId).toHaveBeenCalledWith('shift_reminder:new-shift:60', 'native-new');
  });

  it('cancelForShift cancels all related notifications', async () => {
    scheduledRepo.listByShiftId.mockResolvedValue([{
      logicalKey: 'shift_reminder:s-1:60',
      type: 'shift_reminder',
      scheduledFor: '2026-08-04T09:00:00Z',
      nativeId: 'native-1',
      shiftId: 's-1',
      titleKey: '',
      bodyKey: '',
      createdAt: '',
      updatedAt: '',
    }]);

    await reconciler.cancelForShift('s-1');

    expect(adapter.cancelNotification).toHaveBeenCalledWith('native-1');
    expect(scheduledRepo.deleteByShiftId).toHaveBeenCalledWith('s-1');
  });
});
