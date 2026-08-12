/**
 * Week Calendar Service — pure layout computations, no React.
 *
 * Produces a 7-day week grid with shift positioning data.
 * RTL-aware: returns day order for both LTR and RTL layouts.
 */

import { addDays, startOfWeek, format, parseISO, differenceInMinutes, getDay } from 'date-fns';

import type { Shift } from '@/domain/entities';
import { getEffectiveShiftRange } from '@/domain/services/shift-overlap-service';
import { formatWeekdayDateValue } from '@/shared/utils/date-time-format';

export interface WeekDay {
  localDate: string; // yyyy-MM-dd
  isToday: boolean;
  dayOfWeek: number; // 0=Sun
  label: string;
}

export interface ShiftTimeBlock {
  shift: Shift;
  /** Minutes from midnight local time */
  startMinutes: number;
  /** Duration in minutes (capped at 24h) */
  durationMinutes: number;
  /** Whether this shift crosses midnight */
  crossesMidnight: boolean;
  /** Column index for overlapping shifts (0-based) */
  column: number;
  /** Total columns in this day */
  totalColumns: number;
}

export interface WeekDayData {
  day: WeekDay;
  blocks: ShiftTimeBlock[];
}

export interface WeekCalendarData {
  /** Start of week (Sunday) */
  weekStart: string;
  /** End of week (Saturday) */
  weekEnd: string;
  days: WeekDayData[];
  /** For RTL, reverse the days array display order */
  isRtl: boolean;
}

const MINUTES_PER_DAY = 24 * 60;

export function buildWeekCalendarData(
  weekOf: Date,
  shifts: readonly Shift[],
  timezone: string,
  locale: string,
  isRtl = false,
): WeekCalendarData {
  const sunday = startOfWeek(weekOf, { weekStartsOn: 0 });
  const weekStart = format(sunday, 'yyyy-MM-dd');
  const weekEnd = format(addDays(sunday, 6), 'yyyy-MM-dd');
  const todayDate = formatLocalDate(new Date(), timezone);

  const days: WeekDayData[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(sunday, i);
    const localDate = format(dayDate, 'yyyy-MM-dd');
    const dayShifts = shifts.filter((s) => shiftBelongsToDay(s, localDate, timezone));

    const blocks = buildDayBlocks(dayShifts, localDate, timezone);

    days.push({
      day: {
        localDate,
        isToday: localDate === todayDate,
        dayOfWeek: getDay(dayDate),
        label: formatWeekdayDateValue(localDate, locale.startsWith('he') ? 'he' : 'en'),
      },
      blocks,
    });
  }

  return { weekStart, weekEnd, days, isRtl };
}

function shiftBelongsToDay(shift: Shift, localDate: string, timezone: string): boolean {
  const { start } = getEffectiveShiftRange(shift);
  const startLocalDate = formatLocalDate(parseISO(start), timezone);
  return startLocalDate === localDate;
}

function buildDayBlocks(dayShifts: readonly Shift[], localDate: string, timezone: string): ShiftTimeBlock[] {
  const rawBlocks: Omit<ShiftTimeBlock, 'column' | 'totalColumns'>[] = dayShifts.map((shift) => {
    const { start, end } = getEffectiveShiftRange(shift);

    const startMinutes = getLocalMinutes(parseISO(start), timezone);
    const durationMinutes = Math.min(MINUTES_PER_DAY, Math.max(1, differenceInMinutes(parseISO(end), parseISO(start))));

    return {
      shift,
      startMinutes,
      durationMinutes,
      crossesMidnight: startMinutes + durationMinutes > MINUTES_PER_DAY,
    };
  });

  // Assign columns for overlapping shifts
  const withColumns = assignColumns(rawBlocks);
  return withColumns;
}

function assignColumns(blocks: Omit<ShiftTimeBlock, 'column' | 'totalColumns'>[]): ShiftTimeBlock[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const result: ShiftTimeBlock[] = [];

  // Simple greedy column assignment
  const columns: number[][] = []; // columns[colIdx] = endMinute of last block in that column

  for (const block of sorted) {
    let assignedCol = -1;
    for (let col = 0; col < columns.length; col++) {
      if ((columns[col]?.at(-1) ?? 0) <= block.startMinutes) {
        assignedCol = col;
        break;
      }
    }
    if (assignedCol === -1) {
      assignedCol = columns.length;
      columns.push([]);
    }
    columns[assignedCol]!.push(block.startMinutes + block.durationMinutes);
    result.push({ ...block, column: assignedCol, totalColumns: 0 }); // totalColumns filled below
  }

  const totalCols = columns.length;
  return result.map((b) => ({ ...b, totalColumns: totalCols }));
}

function getLocalMinutes(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = fmt.formatToParts(date);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

function formatLocalDate(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(date);
  } catch {
    return format(date, 'yyyy-MM-dd');
  }
}

export function getPreviousWeek(weekOf: Date): Date {
  return addDays(startOfWeek(weekOf, { weekStartsOn: 0 }), -7);
}

export function getNextWeek(weekOf: Date): Date {
  return addDays(startOfWeek(weekOf, { weekStartsOn: 0 }), 7);
}
