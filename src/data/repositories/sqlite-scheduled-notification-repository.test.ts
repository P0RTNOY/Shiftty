import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteScheduledNotificationRepository } from '@/data/repositories/sqlite-scheduled-notification-repository';

it('manages scheduled notification metadata', async () => {
  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };
  const repo = new SqliteScheduledNotificationRepository(db as unknown as SQLiteDatabase);

  // upsert
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.upsert({
    logicalKey: 'shift_reminder:s-1:60',
    type: 'shift_reminder',
    scheduledFor: '2026-08-04T10:00:00Z',
    shiftId: 's-1',
    titleKey: 'title',
    bodyKey: 'body',
    bodyParams: { a: 1 },
    nativeId: 'native-1',
  });
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO scheduled_notification_records'),
    expect.arrayContaining(['shift_reminder:s-1:60', 'shift_reminder', '2026-08-04T10:00:00Z', 's-1', 'title', 'body', '{"a":1}', 'native-1'])
  );

  // update native id
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.updateNativeId('shift_reminder:s-1:60', 'native-2');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE scheduled_notification_records SET native_id = ?'),
    expect.arrayContaining(['native-2', 'shift_reminder:s-1:60'])
  );

  // list by shift
  db.getAllAsync.mockResolvedValueOnce([{
    logical_key: 'shift_reminder:s-1:60',
    type: 'shift_reminder',
    scheduled_for: '2026-08-04T10:00:00Z',
    shift_id: 's-1',
    title_key: 'title',
    body_key: 'body',
    body_params_json: '{"a":1}',
    native_id: 'native-2',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }]);
  const list = await repo.listByShiftId('s-1');
  expect(list).toHaveLength(1);
  expect(list[0]?.logicalKey).toBe('shift_reminder:s-1:60');
  expect(list[0]?.bodyParams).toEqual({ a: 1 });

  // delete by key
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.deleteByLogicalKey('shift_reminder:s-1:60');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('DELETE FROM scheduled_notification_records WHERE logical_key = ?;'),
    ['shift_reminder:s-1:60']
  );

  // delete by shift id
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.deleteByShiftId('s-1');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('DELETE FROM scheduled_notification_records WHERE shift_id = ?;'),
    ['s-1']
  );
});
