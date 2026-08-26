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
      listScheduledNotificationIds: jest.fn().mockResolvedValue(new Set([
        'native-old', 'native-1', 'native-2', 'native-concurrent', 'native-id',
      ])),
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

  it('does not create persisted notification ghosts before permission is granted', async () => {
    adapter.getPermissionStatus.mockResolvedValue('undetermined');
    await reconciler.reconcile({ now: new Date(), timezone: TIMEZONE, upcomingShifts: [], activeShift: null, activeBreak: null });

    expect(settingsRepo.getGlobal).not.toHaveBeenCalled();
    expect(scheduledRepo.upsert).not.toHaveBeenCalled();
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

  it('reschedules a desired reminder when persisted metadata no longer exists natively', async () => {
    adapter.getPermissionStatus.mockResolvedValue('granted');
    adapter.listScheduledNotificationIds.mockResolvedValue(new Set());
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true, scheduledShiftReminders: true, shiftReminderOffsets: [60], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 15, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 15,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    settingsRepo.getWorkplaceOverride.mockResolvedValue(null);
    scheduledRepo.listAll.mockResolvedValue([{
      logicalKey: 'shift_reminder:recover:60', type: 'shift_reminder',
      scheduledFor: '2026-08-04T08:00:00.000Z', nativeId: 'native-removed',
      shiftId: 'recover', workplaceId: 'wp-1', titleKey: '', bodyKey: '', createdAt: '', updatedAt: '',
    }]);
    adapter.scheduleNotification.mockResolvedValue('native-recreated');
    const upcomingShift: Shift = {
      id: 'recover', workplaceId: 'wp-1', status: 'scheduled',
      scheduledStart: '2026-08-04T12:00:00+03:00', scheduledEnd: '2026-08-04T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, salaryCalculationStatus: 'not_calculated',
      timezone: TIMEZONE, createdAt: '', updatedAt: '',
    };

    await reconciler.reconcile({
      now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE,
      upcomingShifts: [upcomingShift], activeShift: null, activeBreak: null,
    });

    expect(scheduledRepo.deleteByLogicalKey).toHaveBeenCalledWith('shift_reminder:recover:60');
    expect(adapter.scheduleNotification).toHaveBeenCalledTimes(1);
    expect(scheduledRepo.updateNativeId).toHaveBeenCalledWith('shift_reminder:recover:60', 'native-recreated');
  });

  it('trusts persisted metadata when native-state inspection fails', async () => {
    const inspectionError = new Error('native scheduler unavailable');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    adapter.getPermissionStatus.mockResolvedValue('granted');
    adapter.listScheduledNotificationIds.mockRejectedValue(inspectionError);
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true, scheduledShiftReminders: true, shiftReminderOffsets: [60], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 15, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 15,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    settingsRepo.getWorkplaceOverride.mockResolvedValue(null);
    scheduledRepo.listAll.mockResolvedValue([{
      logicalKey: 'shift_reminder:existing:60', type: 'shift_reminder',
      scheduledFor: '2026-08-04T08:00:00.000Z', nativeId: 'native-existing',
      shiftId: 'existing', workplaceId: 'wp-1', titleKey: '', bodyKey: '', createdAt: '', updatedAt: '',
    }]);
    const upcomingShift: Shift = {
      id: 'existing', workplaceId: 'wp-1', status: 'scheduled',
      scheduledStart: '2026-08-04T12:00:00+03:00', scheduledEnd: '2026-08-04T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, salaryCalculationStatus: 'not_calculated',
      timezone: TIMEZONE, createdAt: '', updatedAt: '',
    };

    await reconciler.reconcile({
      now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE,
      upcomingShifts: [upcomingShift], activeShift: null, activeBreak: null,
    });

    expect(adapter.scheduleNotification).not.toHaveBeenCalled();
    expect(scheduledRepo.deleteByLogicalKey).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('[Shiftty:notifications.listScheduled]', inspectionError);
    errorSpy.mockRestore();
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

  it('logs native scheduling failures while retaining retryable metadata', async () => {
    const diagnostic = new Error('FunctionCallException: native scheduling failed');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    adapter.getPermissionStatus.mockResolvedValue('granted');
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true, scheduledShiftReminders: true, shiftReminderOffsets: [60], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 10, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 60,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    scheduledRepo.listAll.mockResolvedValue([]);
    adapter.scheduleNotification.mockRejectedValue(diagnostic);
    const upcomingShift: Shift = {
      id: 'retry-shift', workplaceId: 'wp-1', status: 'scheduled', scheduledStart: '2026-08-04T12:00:00+03:00', scheduledEnd: '2026-08-04T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, salaryCalculationStatus: 'not_calculated', timezone: TIMEZONE, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    };

    await expect(reconciler.reconcile({ now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE, upcomingShifts: [upcomingShift], activeShift: null, activeBreak: null })).resolves.toBeUndefined();
    expect(scheduledRepo.upsert).toHaveBeenCalled();
    expect(scheduledRepo.updateNativeId).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('[Shiftty:notifications.schedule]', diagnostic);
    errorSpy.mockRestore();
  });

  it('does not hide a persisted-metadata deletion failure', async () => {
    const persistenceError = new Error('database is locked');
    adapter.getPermissionStatus.mockResolvedValue('granted');
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: false, scheduledShiftReminders: false, shiftReminderOffsets: [], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 10, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 60,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    scheduledRepo.listAll.mockResolvedValue([{
      logicalKey: 'shift_reminder:obsolete:60', type: 'shift_reminder', scheduledFor: '2026-08-04T09:00:00Z',
      nativeId: 'native-obsolete', titleKey: '', bodyKey: '', createdAt: '', updatedAt: '',
    }]);
    scheduledRepo.deleteByLogicalKey.mockRejectedValue(persistenceError);

    await expect(reconciler.reconcile({ now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE, upcomingShifts: [], activeShift: null, activeBreak: null })).rejects.toBe(persistenceError);
  });

  it('logs native cancellation failures while continuing metadata cleanup', async () => {
    const cancellationError = new Error('native notification no longer exists');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    adapter.cancelNotification.mockRejectedValue(cancellationError);
    scheduledRepo.listByShiftId.mockResolvedValue([{
      logicalKey: 'shift_reminder:s-2:60', type: 'shift_reminder', scheduledFor: '2026-08-04T09:00:00Z',
      nativeId: 'native-2', shiftId: 's-2', titleKey: '', bodyKey: '', createdAt: '', updatedAt: '',
    }]);

    await reconciler.cancelForShift('s-2');

    expect(errorSpy).toHaveBeenCalledWith('[Shiftty:notifications.cancel]', cancellationError);
    expect(scheduledRepo.deleteByShiftId).toHaveBeenCalledWith('s-2');
    errorSpy.mockRestore();
  });

  it('loads and applies notification overrides for every upcoming workplace', async () => {
    adapter.getPermissionStatus.mockResolvedValue('granted');
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true, scheduledShiftReminders: true, shiftReminderOffsets: [60], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 10, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 60,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    settingsRepo.getWorkplaceOverride.mockImplementation(async (workplaceId) => workplaceId === 'wp-1'
      ? { workplaceId, scheduledShiftReminders: false, updatedAt: '2026-08-04T09:00:00Z' }
      : null);
    scheduledRepo.listAll.mockResolvedValue([]);
    adapter.scheduleNotification.mockResolvedValue('native-id');
    const baseShift: Shift = {
      id: 'shift-wp-1', workplaceId: 'wp-1', status: 'scheduled', scheduledStart: '2026-08-04T12:00:00+03:00', scheduledEnd: '2026-08-04T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, salaryCalculationStatus: 'not_calculated', timezone: TIMEZONE, createdAt: '', updatedAt: '',
    };

    await reconciler.reconcile({
      now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE,
      upcomingShifts: [baseShift, { ...baseShift, id: 'shift-wp-2', workplaceId: 'wp-2' }],
      activeShift: null, activeBreak: null,
    });

    expect(settingsRepo.getWorkplaceOverride).toHaveBeenCalledWith('wp-1');
    expect(settingsRepo.getWorkplaceOverride).toHaveBeenCalledWith('wp-2');
    expect(scheduledRepo.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ shiftId: 'shift-wp-1' }));
    expect(scheduledRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ shiftId: 'shift-wp-2' }));
  });

  it('serializes concurrent reconcilers so a logical notification is scheduled once', async () => {
    adapter.getPermissionStatus.mockResolvedValue('granted');
    settingsRepo.getGlobal.mockResolvedValue({
      masterEnabled: true, scheduledShiftReminders: true, shiftReminderOffsets: [60], missedClockInReminders: false,
      expectedEndReminders: false, overdueShiftReminders: false, longBreakReminders: false,
      missedClockInGraceMinutes: 10, longUnpaidBreakThresholdMinutes: 30, longPaidBreakThresholdMinutes: 60,
      dailySummaryEnabled: false, dailySummaryTime: '20:00',
    });
    settingsRepo.getWorkplaceOverride.mockResolvedValue(null);
    const records: Awaited<ReturnType<ScheduledNotificationRepository['listAll']>> = [];
    scheduledRepo.listAll.mockImplementation(async () => records.map((record) => ({ ...record })));
    scheduledRepo.upsert.mockImplementation(async (record) => {
      const index = records.findIndex((item) => item.logicalKey === record.logicalKey);
      const stored = { ...record, createdAt: '', updatedAt: '' };
      if (index >= 0) records[index] = stored;
      else records.push(stored);
    });
    scheduledRepo.updateNativeId.mockImplementation(async (logicalKey, nativeId) => {
      const record = records.find((item) => item.logicalKey === logicalKey);
      if (record) record.nativeId = nativeId;
    });
    let releaseFirstSchedule!: (nativeId: string) => void;
    adapter.scheduleNotification
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirstSchedule = resolve; }))
      .mockResolvedValue('unexpected-duplicate');
    const upcomingShift: Shift = {
      id: 'concurrent-shift', workplaceId: 'wp-1', status: 'scheduled',
      scheduledStart: '2026-08-04T12:00:00+03:00', scheduledEnd: '2026-08-04T16:00:00+03:00',
      expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 0, salaryCalculationStatus: 'not_calculated',
      timezone: TIMEZONE, createdAt: '', updatedAt: '',
    };
    const input = {
      now: new Date('2026-08-04T10:00:00+03:00'), timezone: TIMEZONE,
      upcomingShifts: [upcomingShift], activeShift: null, activeBreak: null,
    };
    const otherReconciler = new NotificationReconciler(settingsRepo, scheduledRepo, adapter, resolveText);

    const first = reconciler.reconcile(input);
    while (adapter.scheduleNotification.mock.calls.length === 0) await Promise.resolve();
    const second = otherReconciler.reconcile(input);
    await Promise.resolve();

    expect(adapter.scheduleNotification).toHaveBeenCalledTimes(1);
    releaseFirstSchedule('native-concurrent');
    await Promise.all([first, second]);
    expect(adapter.scheduleNotification).toHaveBeenCalledTimes(1);
    expect(records).toEqual([expect.objectContaining({ logicalKey: 'shift_reminder:concurrent-shift:60', nativeId: 'native-concurrent' })]);
  });
});
