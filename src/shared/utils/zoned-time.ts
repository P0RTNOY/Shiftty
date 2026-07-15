import { TZDate } from '@date-fns/tz';
import { addDays, differenceInMinutes } from 'date-fns';

import { DEFAULT_TIMEZONE } from '@/shared/constants/app';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ResolvedShiftRange {
  start: string;
  end: string;
  durationMinutes: number;
  crossesMidnight: boolean;
}

export function resolveLocalShiftRange(
  localDate: string,
  startTime: string,
  endTime: string,
  timezone = DEFAULT_TIMEZONE,
): ResolvedShiftRange {
  const [year, month, day] = parseLocalDate(localDate);
  const [startHour, startMinute] = parseLocalTime(startTime);
  const [endHour, endMinute] = parseLocalTime(endTime);

  if (startHour === endHour && startMinute === endMinute) {
    throw new Error('Start and end time cannot be identical.');
  }

  const start = new TZDate(year, month - 1, day, startHour, startMinute, timezone);
  let end = new TZDate(year, month - 1, day, endHour, endMinute, timezone);
  const crossesMidnight = end.getTime() < start.getTime();

  if (crossesMidnight) {
    const nextLocalDay = addDays(new TZDate(year, month - 1, day, 12, 0, timezone), 1);
    end = new TZDate(
      nextLocalDay.getFullYear(),
      nextLocalDay.getMonth(),
      nextLocalDay.getDate(),
      endHour,
      endMinute,
      timezone,
    );
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    durationMinutes: differenceInMinutes(end, start),
    crossesMidnight,
  };
}

function parseLocalDate(value: string): [number, number, number] {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) {
    throw new Error('Date must use YYYY-MM-DD format.');
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error('Date is not valid.');
  }

  return [year, month, day];
}

function parseLocalTime(value: string): [number, number] {
  const parts = value.match(TIME_PATTERN);
  if (!parts) {
    throw new Error('Time must use 24-hour HH:mm format.');
  }

  return [Number(parts[1]), Number(parts[2])];
}
