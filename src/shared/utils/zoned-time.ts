import { TZDate, tzOffset } from '@date-fns/tz';
import { addDays, differenceInMinutes, format } from 'date-fns';

import { DEFAULT_TIMEZONE } from '@/shared/constants/app';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ResolvedShiftRange {
  start: string;
  end: string;
  durationMinutes: number;
  crossesMidnight: boolean;
}

export function formatLocalDateKey(value: Date | string, timezone = DEFAULT_TIMEZONE): string {
  return format(TZDate.tz(timezone, typeof value === 'string' ? new Date(value) : value), 'yyyy-MM-dd');
}

export function formatLocalTime(value: Date | string, timezone = DEFAULT_TIMEZONE): string {
  const date = TZDate.tz(timezone, typeof value === 'string' ? new Date(value) : value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

export function resolveLocalDateTime(localDate: string, localTime: string, timezone = DEFAULT_TIMEZONE): string {
  const [year, month, day] = parseLocalDate(localDate);
  const [hour, minute] = parseLocalTime(localTime);
  const fallback = new TZDate(year, month - 1, day, hour, minute, timezone);
  const nominalWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set([
    tzOffset(timezone, new Date(nominalWallTime - 36 * 60 * 60_000)),
    tzOffset(timezone, new Date(nominalWallTime)),
    tzOffset(timezone, new Date(nominalWallTime + 36 * 60 * 60_000)),
  ]);
  const matchingInstants: number[] = [];

  for (const offset of offsets) {
    if (!Number.isFinite(offset)) continue;
    const instant = nominalWallTime - offset * 60_000;
    const candidate = TZDate.tz(timezone, new Date(instant));
    if (
      candidate.getFullYear() === year
      && candidate.getMonth() === month - 1
      && candidate.getDate() === day
      && candidate.getHours() === hour
      && candidate.getMinutes() === minute
      && candidate.getSeconds() === 0
      && candidate.getMilliseconds() === 0
    ) {
      matchingInstants.push(instant);
    }
  }

  // A fall-back overlap has two matching instants. Choosing the smaller one
  // makes "earlier" deterministic across host operating-system time zones.
  // A spring-forward gap has no match, so preserve TZDate's forward
  // normalization used by existing scheduling semantics.
  return matchingInstants.length
    ? TZDate.tz(timezone, new Date(Math.min(...matchingInstants))).toISOString()
    : fallback.toISOString();
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
