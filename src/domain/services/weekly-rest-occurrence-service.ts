import { TZDate } from '@date-fns/tz';

import {
  calendarEvidenceIntervalSchema,
  weeklyRestScheduleSchema,
  type CalendarEvidenceInterval,
  type WeeklyRestSchedule,
} from '@/domain/entities';
import { formatLocalDateKey, resolveLocalDateTime } from '@/shared/utils/zoned-time';

/**
 * Expands one confirmed schedule only for the requested half-open range.
 *
 * Boundaries are resolved as local wall-clock values in the salary profile's
 * timezone. `TZDate` deterministically moves a nonexistent spring-forward
 * wall time forward and selects the earlier occurrence of an ambiguous
 * fall-back wall time. The resulting interval duration is elapsed real time,
 * so it may differ from the nominal wall-clock duration at a DST transition.
 */
export function resolveWeeklyRestOccurrences(
  scheduleInput: WeeklyRestSchedule,
  rangeStart: string,
  rangeEnd: string,
  timezone: string,
): CalendarEvidenceInterval[] {
  const schedule = weeklyRestScheduleSchema.parse(scheduleInput);
  const startMs = Date.parse(rangeStart);
  const endMs = Date.parse(rangeEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('Weekly-rest occurrence range end must be after its start.');
  }
  if (endMs - startMs > 370 * 24 * 60 * 60_000) {
    throw new Error('Weekly-rest occurrence resolution is limited to a bounded 370-day range.');
  }
  // Resolve through the interval schema as a cheap, shared IANA validation.
  const validateTimezone = calendarEvidenceIntervalSchema.shape.timezone.safeParse(timezone);
  if (!validateTimezone.success) throw new Error('A valid IANA timezone is required.');
  if (!schedule.enabled || schedule.isArchived || !schedule.confirmedAt) return [];

  const firstLocalDate = addLocalDays(formatLocalDateKey(rangeStart, timezone), -7);
  const lastLocalDate = addLocalDays(formatLocalDateKey(rangeEnd, timezone), 1);
  const output: CalendarEvidenceInterval[] = [];

  for (let localDate = firstLocalDate; localDate <= lastLocalDate; localDate = addLocalDays(localDate, 1)) {
    const localNoon = TZDate.tz(timezone, new Date(resolveLocalDateTime(localDate, '12:00', timezone)));
    if (localNoon.getDay() !== schedule.startWeekday) continue;
    const endDayDistance = endBoundaryDayDistance(schedule);
    const endLocalDate = addLocalDays(localDate, endDayDistance);
    const start = resolveLocalDateTime(localDate, schedule.startTime, timezone);
    const end = resolveLocalDateTime(endLocalDate, schedule.endTime, timezone);
    if (Date.parse(start) >= endMs || Date.parse(end) <= startMs) continue;

    output.push(calendarEvidenceIntervalSchema.parse({
      id: `weekly-rest:${schedule.id}:${localDate}`,
      scheduleId: schedule.id,
      workplaceId: schedule.workplaceId,
      salaryProfileId: schedule.salaryProfileId,
      type: 'weekly_rest',
      name: schedule.label,
      start,
      end,
      timezone,
      sourceKind: schedule.sourceKind,
      sourceTitle: schedule.sourceTitle,
      sourceUrl: schedule.sourceUrl,
      presetId: schedule.presetId,
      presetVersion: schedule.presetVersion,
      confirmedAt: schedule.confirmedAt,
      isArchived: false,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));
  }

  return output.sort(compareIntervals);
}

function endBoundaryDayDistance(schedule: WeeklyRestSchedule): number {
  const weekdayDistance = (schedule.endWeekday - schedule.startWeekday + 7) % 7;
  if (weekdayDistance > 0) return weekdayDistance;
  return schedule.endTime > schedule.startTime ? 0 : 7;
}

function addLocalDays(localDate: string, amount: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + amount)).toISOString().slice(0, 10);
}

function compareIntervals(left: CalendarEvidenceInterval, right: CalendarEvidenceInterval): number {
  return Date.parse(left.start) - Date.parse(right.start)
    || Date.parse(left.end) - Date.parse(right.end)
    || left.type.localeCompare(right.type)
    || left.id.localeCompare(right.id);
}
