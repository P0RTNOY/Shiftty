import type { SQLiteDatabase } from 'expo-sqlite';

import { SqliteShiftRepository } from '@/data/repositories/sqlite-shift-repository';
import { createShift } from '@/test/fixtures';

const row = {
  id: 'shift-1',
  workplace_id: 'workplace-1',
  role_id: null,
  salary_profile_id: null,
  title: null,
  notes: null,
  scheduled_start: '2026-07-15T13:30:00+03:00',
  scheduled_end: '2026-07-15T22:00:00+03:00',
  actual_start: null,
  actual_end: null,
  payable_start: null,
  payable_end: null,
  expected_break_minutes: 30,
  actual_break_minutes: null,
  payable_break_minutes: null,
  status: 'scheduled',
  hourly_rate_snapshot_minor: 4500,
  expected_gross_pay_minor: null,
  actual_gross_pay_minor: null,
  payable_gross_pay_minor: null,
  recurrence_group_id: null,
  timezone: 'Asia/Jerusalem',
  created_at: '2026-07-01T10:00:00+03:00',
  updated_at: '2026-07-01T10:00:00+03:00',
};

function createDatabaseMock() {
  return {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  };
}

describe('SqliteShiftRepository', () => {
  it('maps persisted rows into validated domain shifts', async () => {
    const database = createDatabaseMock();
    database.getFirstAsync.mockResolvedValue(row);
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);

    await expect(repository.getById('shift-1')).resolves.toEqual(createShift());
  });

  it('builds bounded, parameterized list queries', async () => {
    const database = createDatabaseMock();
    database.getAllAsync.mockResolvedValue([row]);
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);

    const shifts = await repository.list({
      startsBefore: '2026-08-01T00:00:00+03:00',
      endsAfter: '2026-07-01T00:00:00+03:00',
      statuses: ['scheduled', 'active'],
      workplaceId: 'workplace-1',
    });

    expect(shifts).toHaveLength(1);
    const [sql, ...parameters] = database.getAllAsync.mock.calls[0] ?? [];
    expect(sql).toContain('scheduled_start < ?');
    expect(sql).toContain('status IN (?, ?)');
    expect(parameters).toEqual([
      '2026-08-01T00:00:00+03:00',
      '2026-07-01T00:00:00+03:00',
      'workplace-1',
      'scheduled',
      'active',
    ]);
  });

  it('validates and persists all independent time fields', async () => {
    const database = createDatabaseMock();
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:24:00+03:00',
      actualEnd: '2026-07-15T22:07:00+03:00',
      payableStart: '2026-07-15T13:30:00+03:00',
      payableEnd: '2026-07-15T22:00:00+03:00',
    });

    await repository.save(shift);

    expect(database.runAsync).toHaveBeenCalledTimes(1);
    const parameters = database.runAsync.mock.calls[0]?.slice(1);
    expect(parameters).toContain(shift.scheduledStart);
    expect(parameters).toContain(shift.actualStart);
    expect(parameters).toContain(shift.payableStart);
    expect(parameters).toHaveLength(24);
  });
});
