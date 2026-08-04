import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { breakSessionSchema, shiftSchema, type BreakSession, type Shift } from '@/domain/entities';
import type { ActiveShiftCancellationMode, ActiveShiftRepository, CompleteShiftInput } from '@/domain/repositories';
import { SqliteShiftRepository, SHIFT_COLUMN_COUNT, SHIFT_COLUMNS, toShiftParameters } from '@/data/repositories/sqlite-shift-repository';

interface BreakRow { id: string; shift_id: string; start_at: string; end_at: string | null; is_paid: number; source: 'tracked' | 'manual'; notes: string | null; created_at: string; updated_at: string }
const BREAK_COLUMNS = 'id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at';

export class SqliteActiveShiftRepository implements ActiveShiftRepository {
  private readonly shifts: SqliteShiftRepository;
  constructor(private readonly database: SQLiteDatabase) { this.shifts = new SqliteShiftRepository(database); }

  async startScheduledShift(shiftId: string, startedAt: string, expectedEnd?: string): Promise<Shift> {
    await this.database.withTransactionAsync(async () => {
      const result = await this.database.runAsync(
        `UPDATE shifts SET status = 'active', actual_start = ?, actual_end = NULL,
          expected_end = COALESCE(?, scheduled_end), active_origin = 'scheduled', updated_at = ?
         WHERE id = ? AND status = 'scheduled';`,
        startedAt, expectedEnd ?? null, startedAt, shiftId,
      );
      if (result.changes !== 1) throw new Error('The scheduled shift is no longer available to start.');
    });
    return this.requireShift(shiftId);
  }

  async startUnscheduledShift(input: Shift): Promise<Shift> {
    const shift = shiftSchema.parse(input);
    if (shift.status !== 'active' || shift.activeOrigin !== 'unscheduled' || !shift.actualStart) throw new Error('A new unscheduled shift must be active.');
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(`INSERT INTO shifts (${SHIFT_COLUMNS}) VALUES (${Array.from({ length: SHIFT_COLUMN_COUNT }, () => '?').join(', ')});`, ...toShiftParameters(shift));
    });
    return this.requireShift(shift.id);
  }

  getActiveShift(): Promise<Shift | null> { return this.shifts.findActive(); }

  async getActiveBreak(shiftId: string): Promise<BreakSession | null> {
    const row = await this.database.getFirstAsync<BreakRow>(`SELECT ${BREAK_COLUMNS} FROM break_sessions WHERE shift_id = ? AND end_at IS NULL LIMIT 1;`, shiftId);
    return row ? mapBreakRow(row) : null;
  }

  async listBreaks(shiftId: string): Promise<BreakSession[]> {
    const rows = await this.database.getAllAsync<BreakRow>(`SELECT ${BREAK_COLUMNS} FROM break_sessions WHERE shift_id = ? ORDER BY start_at ASC;`, shiftId);
    return rows.map(mapBreakRow);
  }

  async listBreaksForShifts(shiftIds: readonly string[]): Promise<BreakSession[]> {
    if (!shiftIds.length) return [];
    const rows = await this.database.getAllAsync<BreakRow>(`SELECT ${BREAK_COLUMNS} FROM break_sessions WHERE shift_id IN (${shiftIds.map(() => '?').join(', ')}) ORDER BY shift_id, start_at ASC;`, ...(shiftIds as SQLiteBindValue[]));
    return rows.map(mapBreakRow);
  }

  async startBreak(input: BreakSession): Promise<BreakSession> {
    const session = breakSessionSchema.parse(input);
    if (session.end) throw new Error('A tracked break must start open.');
    await this.database.withTransactionAsync(async () => {
      if (await this.getActiveBreak(session.shiftId)) throw new Error('A break is already active.');
      await this.database.runAsync(`INSERT INTO break_sessions (${BREAK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`, ...toBreakParameters(session));
    });
    return this.requireBreak(session.id);
  }

  async endBreak(breakId: string, endedAt: string): Promise<BreakSession> {
    await this.database.withTransactionAsync(async () => {
      const result = await this.database.runAsync('UPDATE break_sessions SET end_at = ?, updated_at = ? WHERE id = ? AND end_at IS NULL AND julianday(?) > julianday(start_at);', endedAt, endedAt, breakId, endedAt);
      if (result.changes !== 1) throw new Error('The break is no longer active or its end time is invalid.');
    });
    return this.requireBreak(breakId);
  }

  async updateExpectedEnd(shiftId: string, expectedEnd: string | undefined, updatedAt: string): Promise<Shift> {
    await this.database.withTransactionAsync(async () => {
      const result = await this.database.runAsync("UPDATE shifts SET expected_end = ?, updated_at = ? WHERE id = ? AND status = 'active';", expectedEnd ?? null, updatedAt, shiftId);
      if (result.changes !== 1) throw new Error('Expected end can only be changed for the active shift.');
    });
    return this.requireShift(shiftId);
  }

  async saveBreak(input: BreakSession): Promise<BreakSession> {
    const session = breakSessionSchema.parse(input);
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(`INSERT INTO break_sessions (${BREAK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET start_at=excluded.start_at, end_at=excluded.end_at, is_paid=excluded.is_paid, source=excluded.source, notes=excluded.notes, updated_at=excluded.updated_at;`, ...toBreakParameters(session));
    });
    return this.requireBreak(session.id);
  }

  async deleteBreak(breakId: string): Promise<void> { await this.database.runAsync('DELETE FROM break_sessions WHERE id = ? AND end_at IS NOT NULL;', breakId); }

  async completeShift(input: CompleteShiftInput): Promise<Shift> {
    await this.database.withTransactionAsync(async () => {
      if (input.closeOpenBreak) {
        await this.database.runAsync('DELETE FROM break_sessions WHERE shift_id = ? AND end_at IS NULL AND julianday(?) <= julianday(start_at);', input.shiftId, input.actualEnd);
        await this.database.runAsync('UPDATE break_sessions SET end_at = ?, updated_at = ? WHERE shift_id = ? AND end_at IS NULL AND julianday(?) > julianday(start_at);', input.actualEnd, input.actualEnd, input.shiftId, input.actualEnd);
      }
      const result = await this.database.runAsync(
        `UPDATE shifts SET status = 'completed', actual_end = ?, payable_start = ?, payable_end = ?,
          actual_break_minutes = ?, payable_break_minutes = ?, payable_source = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'active'
           AND NOT EXISTS (SELECT 1 FROM break_sessions WHERE shift_id = ? AND end_at IS NULL);`,
        input.actualEnd, input.payableStart, input.payableEnd, input.actualBreakMinutes, input.payableBreakMinutes,
        input.payableSource, input.actualEnd, input.actualEnd, input.shiftId, input.shiftId,
      );
      if (result.changes !== 1) throw new Error('The active shift could not be completed safely.');
    });
    return this.requireShift(input.shiftId);
  }

  async cancelActiveShift(shiftId: string, mode: ActiveShiftCancellationMode, timestamp: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      if (mode === 'restore') await this.database.runAsync('DELETE FROM break_sessions WHERE shift_id = ?;', shiftId);
      else {
        await this.database.runAsync('DELETE FROM break_sessions WHERE shift_id = ? AND end_at IS NULL AND julianday(?) <= julianday(start_at);', shiftId, timestamp);
        await this.database.runAsync('UPDATE break_sessions SET end_at = ?, updated_at = ? WHERE shift_id = ? AND end_at IS NULL AND julianday(?) > julianday(start_at);', timestamp, timestamp, shiftId, timestamp);
      }
      if (mode === 'delete') {
        const result = await this.database.runAsync("DELETE FROM shifts WHERE id = ? AND status = 'active' AND active_origin = 'unscheduled';", shiftId);
        if (result.changes !== 1) throw new Error('Only a new unscheduled active shift can be discarded.');
        return;
      }
      const status = mode === 'restore' ? 'scheduled' : 'cancelled';
      const result = await this.database.runAsync(
        `UPDATE shifts SET status = ?, actual_start = CASE WHEN ? = 'scheduled' THEN NULL ELSE actual_start END,
          actual_end = CASE WHEN ? = 'scheduled' THEN NULL ELSE ? END, expected_end = NULL,
          active_origin = NULL, cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE NULL END, updated_at = ?
         WHERE id = ? AND status = 'active' AND (? != 'scheduled' OR active_origin = 'scheduled');`,
        status, status, status, timestamp, status, timestamp, timestamp, shiftId, status,
      );
      if (result.changes !== 1) throw new Error('The active shift cancellation is no longer valid.');
    });
  }

  private async requireShift(id: string): Promise<Shift> { const shift = await this.shifts.getById(id); if (!shift) throw new Error('Shift was not found after persistence.'); return shift; }
  private async requireBreak(id: string): Promise<BreakSession> { const row = await this.database.getFirstAsync<BreakRow>(`SELECT ${BREAK_COLUMNS} FROM break_sessions WHERE id = ?;`, id); if (!row) throw new Error('Break was not found after persistence.'); return mapBreakRow(row); }
}

function toBreakParameters(session: BreakSession) { return [session.id, session.shiftId, session.start, session.end ?? null, session.isPaid ? 1 : 0, session.source, session.notes ?? null, session.createdAt, session.updatedAt]; }
export function mapBreakRow(row: BreakRow): BreakSession { return breakSessionSchema.parse({ id: row.id, shiftId: row.shift_id, start: row.start_at, end: row.end_at ?? undefined, isPaid: row.is_paid === 1, source: row.source, notes: row.notes ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }); }
