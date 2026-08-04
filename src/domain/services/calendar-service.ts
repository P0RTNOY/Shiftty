import { TZDate } from '@date-fns/tz';
import { addDays, format, startOfMonth, startOfWeek } from 'date-fns';

import type { Shift } from '@/domain/entities';
import { calculateShiftDuration } from '@/domain/services/shift-time-service';
import { getEffectiveShiftRange } from '@/domain/services/shift-overlap-service';

export interface CalendarDay {
  localDate: string;
  isCurrentMonth: boolean;
}

export interface ShiftSummaryStatistics {
  completedCount: number;
  scheduledCount: number;
  workedMinutes: number;
  upcomingMinutes: number;
}

export function buildMonthGrid(monthDate: string, weekStartsOn: 0 | 1): CalendarDay[] {
  const month = startOfMonth(new Date(`${monthDate}T12:00:00`));
  const first = startOfWeek(month, { weekStartsOn });
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(first, index);
    return {
      localDate: format(date, 'yyyy-MM-dd'),
      isCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export function groupShiftsByLocalDate(
  shifts: readonly Shift[],
  timezone: string,
): Map<string, Shift[]> {
  const result = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const range = getEffectiveShiftRange(shift);
    const date = TZDate.tz(timezone, new Date(range.start));
    const key = format(date, 'yyyy-MM-dd');
    const dayShifts = result.get(key) ?? [];
    dayShifts.push(shift);
    result.set(key, dayShifts);
  }
  return result;
}

export function summarizeShifts(
  shifts: readonly Shift[],
  now = new Date(),
): ShiftSummaryStatistics {
  return shifts.reduce<ShiftSummaryStatistics>(
    (summary, shift) => {
      if (shift.status === 'completed') {
        summary.completedCount += 1;
        summary.workedMinutes +=
          calculateShiftDuration(shift, shift.payableStart ? 'payable' : 'actual')?.paidMinutes ?? 0;
      }
      if (
        shift.status === 'scheduled' &&
        shift.scheduledStart &&
        new Date(shift.scheduledStart).getTime() > now.getTime()
      ) {
        summary.scheduledCount += 1;
        summary.upcomingMinutes += calculateShiftDuration(shift, 'scheduled')?.paidMinutes ?? 0;
      }
      return summary;
    },
    { completedCount: 0, scheduledCount: 0, workedMinutes: 0, upcomingMinutes: 0 },
  );
}
