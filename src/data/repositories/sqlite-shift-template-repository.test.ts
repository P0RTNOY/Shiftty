import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteShiftTemplateRepository } from '@/data/repositories/sqlite-shift-template-repository';

it('performs CRUD operations on shift templates', async () => {
  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  };
  const repo = new SqliteShiftTemplateRepository(db as unknown as SQLiteDatabase);

  // create
  db.runAsync.mockResolvedValueOnce(undefined);
  db.getFirstAsync.mockResolvedValueOnce({
    id: 't-1',
    name: 'בוקר',
    default_start_time: '08:00',
    default_end_time: '16:00',
    pay_multiplier_basis_points: 15000,
    expected_break_minutes: 30,
    expected_break_type: 'unpaid',
    valid_weekdays: '[0,1,2,3,4]',
    expected_duration_minutes: 480,
    color_token: '#f00',
    workplace_id: 'wp-1',
    role_id: null,
    salary_profile_id: null,
    is_archived: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  const created = await repo.create({
    name: 'בוקר',
    defaultStartTime: '08:00',
    defaultEndTime: '16:00',
    payMultiplierBasisPoints: 15000,
    expectedBreakMinutes: 30,
    expectedBreakType: 'unpaid',
    validWeekdays: [0, 1, 2, 3, 4],
    expectedDurationMinutes: 480,
    colorToken: '#f00',
    workplaceId: 'wp-1',
  });

  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO shift_templates'),
    expect.arrayContaining(['בוקר', '08:00', '16:00', 15000, 30, 'unpaid', '[0,1,2,3,4]', 480, '#f00', 'wp-1'])
  );
  expect(created.name).toBe('בוקר');
  expect(created.validWeekdays).toEqual([0, 1, 2, 3, 4]);
  expect(created.payMultiplierBasisPoints).toBe(15000);

  // update
  db.runAsync.mockResolvedValueOnce(undefined);
  db.getFirstAsync.mockResolvedValueOnce({
    id: 't-1',
    name: 'בוקר מעודכן',
    default_start_time: '08:00',
    default_end_time: '16:00',
    pay_multiplier_basis_points: 17500,
    expected_break_minutes: 30,
    expected_break_type: 'unpaid',
    valid_weekdays: '[1,2,3]',
    expected_duration_minutes: 480,
    color_token: '#f00',
    workplace_id: 'wp-1',
    role_id: null,
    salary_profile_id: null,
    is_archived: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  const updated = await repo.update('t-1', {
    name: 'בוקר מעודכן',
    payMultiplierBasisPoints: 17500,
    validWeekdays: [1, 2, 3],
  });

  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE shift_templates SET'),
    expect.arrayContaining(['בוקר מעודכן', 17500, '[1,2,3]', 't-1'])
  );
  expect(updated.name).toBe('בוקר מעודכן');

  // archive
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.archive('t-1');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE shift_templates SET is_archived = 1'),
    expect.arrayContaining(['t-1'])
  );

  // list active
  db.getAllAsync.mockResolvedValueOnce([]);
  await repo.listActive();
  expect(db.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('WHERE is_archived = 0')
  );

  // permanent delete clears only the live recurrence reference and keeps its snapshots
  db.runAsync.mockResolvedValue(undefined);
  await repo.delete('t-1');
  expect(db.withTransactionAsync).toHaveBeenCalled();
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("json_remove(template_json, '$.shiftTemplateId')"), expect.arrayContaining(['t-1']));
  expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM shift_templates WHERE id = ?;', ['t-1']);

  // duplicate
  db.getFirstAsync.mockResolvedValueOnce({
    id: 't-1',
    name: 'בוקר מעודכן',
    default_start_time: '08:00',
    default_end_time: '16:00',
    pay_multiplier_basis_points: 17500,
    expected_break_minutes: 30,
    expected_break_type: 'unpaid',
    valid_weekdays: '[1,2,3]',
    expected_duration_minutes: 480,
    color_token: '#f00',
    workplace_id: 'wp-1',
    role_id: null,
    salary_profile_id: null,
    is_archived: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
  db.runAsync.mockResolvedValueOnce(undefined);
  db.getFirstAsync.mockResolvedValueOnce({
    id: 't-2',
    name: 'בוקר (עותק)',
    default_start_time: '08:00',
    default_end_time: '16:00',
    pay_multiplier_basis_points: 17500,
    expected_break_minutes: 30,
    expected_break_type: 'unpaid',
    valid_weekdays: '[1,2,3]',
    expected_duration_minutes: 480,
    color_token: '#f00',
    workplace_id: 'wp-1',
    role_id: null,
    salary_profile_id: null,
    is_archived: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  const dup = await repo.duplicate('t-1', 'בוקר (עותק)');
  expect(dup.name).toBe('בוקר (עותק)');
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO shift_templates'),
    expect.arrayContaining(['בוקר (עותק)'])
  );
});

it('rejects a new shift type whose default duration exceeds 12 hours', async () => {
  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  };
  const repo = new SqliteShiftTemplateRepository(db as unknown as SQLiteDatabase);

  await expect(repo.create({
    name: 'Too long',
    defaultStartTime: '08:00',
    defaultEndTime: '20:01',
    expectedBreakMinutes: 0,
  })).rejects.toThrow('cannot exceed 12 hours');
  expect(db.runAsync).not.toHaveBeenCalled();
});
