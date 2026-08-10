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
  shift_template_id: null,
  recurrence_original_start: null,
  recurrence_exception_type: null,
  cancelled_at: null,
  expected_end: null,
  active_origin: null,
  payable_source: null,
  completed_at: null,
  timezone: 'Asia/Jerusalem',
  created_at: '2026-07-01T10:00:00+03:00',
  updated_at: '2026-07-01T10:00:00+03:00',
};

function createDatabaseMock() {
  return {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
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
    expect(sql).toContain("WHEN 'completed' THEN COALESCE(actual_start, payable_start, scheduled_start)");
    expect(sql).toContain("WHEN 'active' THEN COALESCE(actual_start, scheduled_start)");
    expect(sql).toContain('status IN (?, ?)');
    expect(parameters).toEqual([
      '2026-08-01T00:00:00+03:00',
      '2026-07-01T00:00:00+03:00',
      'workplace-1',
      'scheduled',
      'active',
    ]);
  });

  it('uses status-aware payable ranges for salary-period queries', async () => {
    const database = createDatabaseMock();
    database.getAllAsync.mockResolvedValue([]);
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);
    await repository.list({ startsBefore: '2026-09-01T00:00:00+03:00', endsAfter: '2026-08-01T00:00:00+03:00', rangeSource: 'salary' });
    const sql = String(database.getAllAsync.mock.calls.at(-1)?.[0]);
    expect(sql).toContain("WHEN 'completed' THEN COALESCE(payable_start, actual_start, scheduled_start)");
    expect(sql).toContain("WHEN 'completed' THEN COALESCE(payable_end, actual_end, scheduled_end)");
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
    expect(parameters).toHaveLength(36);
  });

  it('queries the next scheduled shift and upcoming shifts', async () => {
    const database = createDatabaseMock();
    database.getFirstAsync.mockResolvedValue(row);
    database.getAllAsync.mockResolvedValue([row]);
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);

    await expect(repository.getNextScheduled('2026-07-01T00:00:00+03:00')).resolves.toEqual(createShift());
    await expect(repository.listUpcoming('2026-07-01T00:00:00+03:00', 10)).resolves.toHaveLength(1);

    expect(database.getFirstAsync.mock.calls.at(-1)?.[0]).toContain("status = 'scheduled'");
    expect(database.getAllAsync.mock.calls.at(-1)?.[0]).toContain('LIMIT ?');
  });

  it('queries overlaps across workplaces while excluding cancelled and edited shifts', async () => {
    const database = createDatabaseMock();
    database.getAllAsync.mockResolvedValue([row]);
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);

    await repository.findOverlapping(
      { start: '2026-07-15T21:00:00+03:00', end: '2026-07-16T02:00:00+03:00' },
      'editing-id',
    );

    const [sql, ...parameters] = database.getAllAsync.mock.calls.at(-1) ?? [];
    expect(sql).toContain("status != 'cancelled'");
    expect(sql).toContain("WHEN 'completed' THEN COALESCE(actual_start, payable_start, scheduled_start)");
    expect(sql).toContain("WHEN 'active' THEN COALESCE(actual_end, expected_end, scheduled_end, actual_start)");
    expect(sql).toContain('id != ?');
    expect(sql).toContain('julianday');
    expect(parameters).toContain('editing-id');
  });

  it('maps completed shifts whose scheduled range is unknown', async () => {
    const database = createDatabaseMock();
    database.getFirstAsync.mockResolvedValue({ ...row, scheduled_start: null, scheduled_end: null, status: 'completed', actual_start: '2026-07-15T09:00:00+03:00', actual_end: '2026-07-15T17:00:00+03:00', payable_start: '2026-07-15T09:00:00+03:00', payable_end: '2026-07-15T17:00:00+03:00', payable_source: 'actual', completed_at: '2026-07-15T17:00:00+03:00' });
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);
    await expect(repository.getById('shift-1')).resolves.toMatchObject({ status: 'completed', scheduledStart: undefined });
  });

  it('propagates a failed batch write so the SQLite transaction can roll back', async () => {
    const database = createDatabaseMock();
    database.runAsync.mockRejectedValueOnce(new Error('disk full'));
    const repository = new SqliteShiftRepository(database as unknown as SQLiteDatabase);
    await expect(repository.saveMany([createShift()])).rejects.toThrow('disk full');
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });
});
