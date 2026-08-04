import type { SQLiteDatabase } from 'expo-sqlite';

import { SqliteActiveShiftRepository } from '@/data/repositories/sqlite-active-shift-repository';
import { createBreak, createShift } from '@/test/fixtures';

const activeRow = {
  id: 'shift-1', workplace_id: 'workplace-1', role_id: null, salary_profile_id: null, title: null, notes: null,
  scheduled_start: '2026-07-15T13:30:00+03:00', scheduled_end: '2026-07-15T22:00:00+03:00',
  actual_start: '2026-07-15T13:24:00+03:00', actual_end: null, payable_start: null, payable_end: null,
  expected_break_minutes: 30, actual_break_minutes: null, payable_break_minutes: null, status: 'active',
  hourly_rate_snapshot_minor: 4500, expected_gross_pay_minor: null, actual_gross_pay_minor: null, payable_gross_pay_minor: null,
  shift_template_id: null, recurrence_group_id: null, recurrence_original_start: null, recurrence_exception_type: null,
  cancelled_at: null, expected_end: '2026-07-15T22:00:00+03:00', active_origin: 'scheduled', payable_source: null,
  completed_at: null, timezone: 'Asia/Jerusalem', created_at: '2026-07-01T10:00:00+03:00', updated_at: '2026-07-15T13:24:00+03:00',
};

const breakRow = { id: 'break-1', shift_id: 'shift-1', start_at: '2026-07-15T17:00:00+03:00', end_at: null, is_paid: 0, source: 'tracked', notes: null, created_at: '2026-07-15T17:00:00+03:00', updated_at: '2026-07-15T17:00:00+03:00' };

function databaseMock() {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(activeRow),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  };
}

describe('SqliteActiveShiftRepository', () => {
  it('starts a scheduled shift transactionally without changing its schedule', async () => {
    const database = databaseMock();
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await repository.startScheduledShift('shift-1', '2026-07-15T13:24:00+03:00');
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    const sql = database.runAsync.mock.calls[0]?.[0];
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("WHERE id = ? AND status = 'scheduled'");
    expect(sql).not.toContain('scheduled_start =');
  });

  it('starts an unscheduled active shift and relies on the single-active constraint', async () => {
    const database = databaseMock();
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    const shift = createShift({ status: 'active', scheduledStart: undefined, scheduledEnd: undefined, actualStart: '2026-07-15T13:24:00+03:00', activeOrigin: 'unscheduled' });
    await repository.startUnscheduledShift(shift);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync.mock.calls[0]?.[0]).toContain('INSERT INTO shifts');
  });

  it('starts and restores one active break', async () => {
    const database = databaseMock();
    database.getFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(breakRow);
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await expect(repository.startBreak(createBreak({ end: undefined }))).resolves.toMatchObject({ id: 'break-1', isPaid: false });
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync.mock.calls[0]?.[0]).toContain('INSERT INTO break_sessions');
  });

  it('prevents a second active break before insert', async () => {
    const database = databaseMock();
    database.getFirstAsync.mockResolvedValueOnce(breakRow);
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await expect(repository.startBreak(createBreak({ end: undefined }))).rejects.toThrow('already active');
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('ends a break idempotently only while it is open', async () => {
    const database = databaseMock();
    database.getFirstAsync.mockResolvedValue({ ...breakRow, end_at: '2026-07-15T17:30:00+03:00', updated_at: '2026-07-15T17:30:00+03:00' });
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await repository.endBreak('break-1', '2026-07-15T17:30:00+03:00');
    expect(database.runAsync.mock.calls[0]?.[0]).toContain('AND end_at IS NULL');
  });

  it('updates expected end without changing the original schedule', async () => {
    const database = databaseMock(); const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await repository.updateExpectedEnd('shift-1', '2026-07-15T23:00:00+03:00', '2026-07-15T14:00:00+03:00');
    const sql = database.runAsync.mock.calls[0]?.[0];
    expect(sql).toContain('expected_end = ?'); expect(sql).not.toContain('scheduled_end =');
  });

  it('completes the shift and closes an open break in one transaction', async () => {
    const database = databaseMock();
    database.getFirstAsync.mockResolvedValue({ ...activeRow, status: 'completed', actual_end: '2026-07-15T22:07:00+03:00', payable_start: '2026-07-15T13:24:00+03:00', payable_end: '2026-07-15T22:07:00+03:00', payable_break_minutes: 30, actual_break_minutes: 30, payable_source: 'actual', completed_at: '2026-07-15T22:07:00+03:00' });
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await repository.completeShift({ shiftId: 'shift-1', actualEnd: '2026-07-15T22:07:00+03:00', payableStart: '2026-07-15T13:24:00+03:00', payableEnd: '2026-07-15T22:07:00+03:00', actualBreakMinutes: 30, payableBreakMinutes: 30, payableSource: 'actual', closeOpenBreak: true });
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync.mock.calls.map((call) => call[0]).join('\n')).toContain("status = 'completed'");
  });

  it('restores or cancels a scheduled active shift without partial writes', async () => {
    const database = databaseMock();
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await repository.cancelActiveShift('shift-1', 'restore', '2026-07-15T14:00:00+03:00');
    expect(database.runAsync.mock.calls.at(-1)?.slice(1)).toContain('scheduled');
    await repository.cancelActiveShift('shift-1', 'cancel', '2026-07-15T14:01:00+03:00');
    expect(database.runAsync.mock.calls.at(-1)?.slice(1)).toContain('cancelled');
  });

  it('propagates a transaction failure', async () => {
    const database = databaseMock();
    database.runAsync.mockRejectedValueOnce(new Error('disk full'));
    const repository = new SqliteActiveShiftRepository(database as unknown as SQLiteDatabase);
    await expect(repository.startScheduledShift('shift-1', '2026-07-15T13:24:00+03:00')).rejects.toThrow('disk full');
  });
});
