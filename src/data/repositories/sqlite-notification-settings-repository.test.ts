import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteNotificationSettingsRepository } from '@/data/repositories/sqlite-notification-settings-repository';

it('manages global preferences and workplace overrides', async () => {
  const db = {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };
  const repo = new SqliteNotificationSettingsRepository(db as unknown as SQLiteDatabase);

  // global defaults
  db.getFirstAsync.mockResolvedValueOnce(null);
  const defaults = await repo.getGlobal();
  expect(defaults.masterEnabled).toBe(true);
  expect(defaults.scheduledShiftReminders).toBe(true);

  // update global
  db.runAsync.mockResolvedValueOnce(undefined);
  const updated = await repo.updateGlobal({ ...defaults, masterEnabled: false });
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO app_settings'),
    expect.arrayContaining([expect.stringContaining('"masterEnabled":false')])
  );
  expect(updated.masterEnabled).toBe(false);

  // get override null
  db.getFirstAsync.mockResolvedValueOnce(null);
  const overrideNull = await repo.getWorkplaceOverride('wp-1');
  expect(overrideNull).toBeNull();

  // update override
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.updateWorkplaceOverride({
    workplaceId: 'wp-1',
    scheduledShiftReminders: false,
    longBreakReminders: undefined,
    updatedAt: new Date().toISOString(),
  });
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO workplace_notification_overrides'),
    expect.arrayContaining(['wp-1', 0, null])
  );

  // get override
  db.getFirstAsync.mockResolvedValueOnce({
    workplace_id: 'wp-1',
    scheduled_shift_reminders: 0,
    long_break_reminders: null,
    updated_at: '2026-01-01T00:00:00Z',
  });
  const override = await repo.getWorkplaceOverride('wp-1');
  expect(override?.scheduledShiftReminders).toBe(false);
  expect(override?.longBreakReminders).toBeUndefined();

  // clear override
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.clearWorkplaceOverride('wp-1');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('DELETE FROM workplace_notification_overrides'),
    ['wp-1']
  );
});
