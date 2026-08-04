import type { BreakSession, PayableSource, Shift } from '@/domain/entities';

export interface CompleteShiftInput {
  shiftId: string;
  actualEnd: string;
  payableStart: string;
  payableEnd: string;
  actualBreakMinutes: number;
  payableBreakMinutes: number;
  payableSource: PayableSource;
  closeOpenBreak: boolean;
}

export type ActiveShiftCancellationMode = 'restore' | 'cancel' | 'delete';

export interface ActiveShiftRepository {
  startScheduledShift(shiftId: string, startedAt: string, expectedEnd?: string): Promise<Shift>;
  startUnscheduledShift(shift: Shift): Promise<Shift>;
  getActiveShift(): Promise<Shift | null>;
  getActiveBreak(shiftId: string): Promise<BreakSession | null>;
  listBreaks(shiftId: string): Promise<BreakSession[]>;
  listBreaksForShifts(shiftIds: readonly string[]): Promise<BreakSession[]>;
  startBreak(session: BreakSession): Promise<BreakSession>;
  endBreak(breakId: string, endedAt: string): Promise<BreakSession>;
  updateExpectedEnd(shiftId: string, expectedEnd: string | undefined, updatedAt: string): Promise<Shift>;
  saveBreak(session: BreakSession): Promise<BreakSession>;
  deleteBreak(breakId: string): Promise<void>;
  completeShift(input: CompleteShiftInput): Promise<Shift>;
  cancelActiveShift(shiftId: string, mode: ActiveShiftCancellationMode, timestamp: string): Promise<void>;
}
