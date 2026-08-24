export const MAX_SHIFT_DURATION_MINUTES = 12 * 60;

export function getShiftRangeDurationMinutes(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 60_000;
}

export function assertShiftDurationWithinLimit(start: string, end: string, grandfatheredDurationMinutes = 0): void {
  const durationMinutes = getShiftRangeDurationMinutes(start, end);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Shift end must be after shift start.');
  }
  if (durationMinutes > Math.max(MAX_SHIFT_DURATION_MINUTES, grandfatheredDurationMinutes)) {
    throw new Error('Shift duration cannot exceed 12 hours.');
  }
}

export function getDefaultShiftDurationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return Number.NaN;
  const start = startHour! * 60 + startMinute!;
  let end = endHour! * 60 + endMinute!;
  if (end <= start) end += 24 * 60;
  return end - start;
}

export function assertDefaultShiftDurationWithinLimit(startTime: string, endTime: string): void {
  const durationMinutes = getDefaultShiftDurationMinutes(startTime, endTime);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Shift end must be after shift start.');
  }
  if (durationMinutes > MAX_SHIFT_DURATION_MINUTES) {
    throw new Error('Shift duration cannot exceed 12 hours.');
  }
}
