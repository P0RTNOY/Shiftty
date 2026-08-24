import type { PayableSource, Shift } from '@/domain/entities';
import { MAX_SHIFT_DURATION_MINUTES } from './shift-duration-policy';

export type RoundingMode = 'nearest' | 'floor' | 'ceiling';
export interface RoundingPreference { incrementMinutes: 5 | 10 | 15 | 30; mode: RoundingMode }
interface PayableSelectionInput { shift: Shift; actualEnd: string; unpaidBreakMinutes: number; source: PayableSource; rounding?: RoundingPreference; manual?: { start: string; end: string; breakMinutes: number } }
export interface PayableSelection { payableStart: string; payableEnd: string; payableBreakMinutes: number; payableSource: PayableSource }
const SUPPORTED_INCREMENTS = [5, 10, 15, 30] as const;

export function roundTimestamp(value: string, incrementMinutes: number, mode: RoundingMode): string {
  if (!(SUPPORTED_INCREMENTS as readonly number[]).includes(incrementMinutes)) throw new Error('Unsupported rounding increment.');
  const incrementMs = incrementMinutes * 60_000;
  const operation = mode === 'floor' ? Math.floor : mode === 'ceiling' ? Math.ceil : Math.round;
  return new Date(operation(Date.parse(value) / incrementMs) * incrementMs).toISOString();
}

export function selectPayableTime(input: PayableSelectionInput): PayableSelection {
  if (!input.shift.actualStart) throw new Error('Actual start is required.');
  let payableStart: string; let payableEnd: string; let payableBreakMinutes = input.unpaidBreakMinutes;
  switch (input.source) {
    case 'actual': payableStart = input.shift.actualStart; payableEnd = input.actualEnd; break;
    case 'scheduled':
      if (!input.shift.scheduledStart || !input.shift.scheduledEnd) throw new Error('Scheduled range is unavailable.');
      payableStart = input.shift.scheduledStart; payableEnd = input.shift.scheduledEnd; break;
    case 'rounded':
      if (!input.rounding) throw new Error('Rounding preference is required.');
      payableStart = roundTimestamp(input.shift.actualStart, input.rounding.incrementMinutes, input.rounding.mode);
      payableEnd = roundTimestamp(input.actualEnd, input.rounding.incrementMinutes, input.rounding.mode); break;
    case 'manual':
      if (!input.manual) throw new Error('Manual payable values are required.');
      payableStart = input.manual.start; payableEnd = input.manual.end; payableBreakMinutes = input.manual.breakMinutes; break;
  }
  const durationMinutes = (Date.parse(payableEnd) - Date.parse(payableStart)) / 60_000;
  if (durationMinutes <= 0) throw new Error('Payable end must be after payable start.');
  // A manual payroll range is a new user decision and must obey the legal/product cap.
  // Recorded actual/rounded/scheduled ranges remain selectable so an overdue live shift
  // can always be clocked out truthfully; the salary engine marks any >12h result invalid.
  if (input.source === 'manual' && durationMinutes > MAX_SHIFT_DURATION_MINUTES) {
    throw new Error('Payable shift duration cannot exceed 12 hours.');
  }
  if (payableBreakMinutes < 0 || payableBreakMinutes > durationMinutes) throw new Error('Payable break cannot exceed payable duration.');
  return { payableStart, payableEnd, payableBreakMinutes, payableSource: input.source };
}
