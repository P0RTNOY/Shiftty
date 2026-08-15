/**
 * Notification Planner — Pure, deterministic, no Expo calls, no SQLite.
 *
 * Takes:
 * - Upcoming shifts (within planning horizon)
 * - Active shift + active break (if any)
 * - Resolved notification preferences
 * - Existing persisted notification records
 * - Current time
 *
 * Produces a NotificationPlan:
 * - notifications: new/changed notifications to schedule
 * - cancellations: logical keys of obsolete notifications to cancel
 *
 * Logical key format:
 * - shift_reminder:        `shift_reminder:{shiftId}:{offsetMinutes}`
 * - missed_clock_in:       `missed_clock_in:{shiftId}`
 * - expected_end_soon:     `expected_end_soon:{shiftId}`
 * - expected_end:          `expected_end:{shiftId}`
 * - overdue_shift:         `overdue_shift:{shiftId}:{overdueSuffix}`
 * - long_break:            `long_break:{shiftId}:{breakId}`
 * - daily_summary:         `daily_summary:{localDate}`
 *
 * Quiet hours policy:
 * - Scheduled-shift reminders respect quiet hours (delay to after quiet hours end)
 * - Active-shift safety reminders (overdue, long break) bypass quiet hours if allowActiveShiftBypass=true
 * - Expected-end reminders for active shifts bypass quiet hours if allowActiveShiftBypass=true
 */

import { addMinutes, isAfter, parseISO, format, addDays, isBefore } from 'date-fns';

import type { Shift, BreakSession } from '@/domain/entities';
import type { PlannedNotification, NotificationPlan, ScheduledNotificationRecord } from '@/domain/entities/scheduled-notification';
import type { ResolvedNotificationPreferences, QuietHours } from '@/domain/entities/notification-preferences';

export interface NotificationPlannerInput {
  now: Date;
  timezone: string;
  upcomingShifts: readonly Shift[];
  activeShift: Shift | null;
  activeBreak: BreakSession | null;
  preferences: ResolvedNotificationPreferences;
  preferencesByWorkplace?: ReadonlyMap<string, ResolvedNotificationPreferences>;
  existingRecords: readonly ScheduledNotificationRecord[];
}

// Overdue escalation points after expected end
const OVERDUE_OFFSETS_MINUTES = [30, 90] as const;

export function buildNotificationPlan(input: NotificationPlannerInput): NotificationPlan {
  if (!input.preferences.masterEnabled) {
    // Cancel everything
    const cancellations = input.existingRecords.map((r) => r.logicalKey);
    return { notifications: [], cancellations };
  }

  const planned: PlannedNotification[] = [];
  const { now } = input;

  // --- Scheduled shift reminders + missed clock-in ---
  for (const shift of input.upcomingShifts) {
      const shiftPreferences = input.preferencesByWorkplace?.get(shift.workplaceId) ?? input.preferences;
      if (!shiftPreferences.scheduledShiftReminders && !shiftPreferences.missedClockInReminders) continue;
      if (!['scheduled'].includes(shift.status)) continue;
      if (!shift.scheduledStart) continue;

      const scheduledStart = parseISO(shift.scheduledStart);
      if (isBefore(scheduledStart, addMinutes(now, -1))) continue; // past

      if (shiftPreferences.scheduledShiftReminders) {
        for (const offsetMinutes of shiftPreferences.shiftReminderOffsets) {
          const fireAt = addMinutes(scheduledStart, -offsetMinutes);
          if (!isAfter(fireAt, now)) continue;

          const adjusted = adjustForQuietHours(fireAt, shiftPreferences.quietHours, false, input.timezone);

          planned.push({
            logicalKey: `shift_reminder:${shift.id}:${offsetMinutes}`,
            type: 'shift_reminder',
            scheduledFor: adjusted.toISOString(),
            shiftId: shift.id,
            workplaceId: shift.workplaceId,
            titleKey: 'notification.shiftReminderTitle',
            bodyKey: offsetMinutes === 0
              ? 'notification.shiftReminderBodyNow'
              : offsetMinutes === 1
                ? 'notification.shiftReminderBodyOne'
                : 'notification.shiftReminderBody',
            bodyParams: { offsetMinutes },
          });
        }
      }

      // Missed clock-in reminder
      if (shiftPreferences.missedClockInReminders) {
        const graceEnd = addMinutes(scheduledStart, shiftPreferences.missedClockInGraceMinutes);
        if (isAfter(graceEnd, now)) {
          planned.push({
            logicalKey: `missed_clock_in:${shift.id}`,
            type: 'missed_clock_in',
            scheduledFor: graceEnd.toISOString(),
            shiftId: shift.id,
            workplaceId: shift.workplaceId,
            titleKey: 'notification.missedClockInTitle',
            bodyKey: 'notification.missedClockInBody',
          });
        }
      }
  }

  // --- Active shift notifications ---
  if (input.activeShift && input.activeShift.status === 'active') {
    const shift = input.activeShift;
    const activePreferences = input.preferencesByWorkplace?.get(shift.workplaceId) ?? input.preferences;
    const expectedEnd = shift.expectedEnd ?? shift.scheduledEnd;

    if (expectedEnd && activePreferences.expectedEndReminders) {
      const expectedEndDate = parseISO(expectedEnd);

      // 15 min before
      const soonAt = addMinutes(expectedEndDate, -15);
      if (isAfter(soonAt, now)) {
        const adjusted = adjustForQuietHours(soonAt, activePreferences.quietHours, activePreferences.quietHours?.allowActiveShiftBypass ?? true, input.timezone);
        planned.push({
          logicalKey: `expected_end_soon:${shift.id}`,
          type: 'expected_end_soon',
          scheduledFor: adjusted.toISOString(),
          shiftId: shift.id,
          workplaceId: shift.workplaceId,
          titleKey: 'notification.expectedSoonTitle',
          bodyKey: 'notification.expectedSoonBody',
        });
      }

      // At expected end
      if (isAfter(expectedEndDate, now)) {
        const adjusted = adjustForQuietHours(expectedEndDate, activePreferences.quietHours, activePreferences.quietHours?.allowActiveShiftBypass ?? true, input.timezone);
        planned.push({
          logicalKey: `expected_end:${shift.id}`,
          type: 'expected_end',
          scheduledFor: adjusted.toISOString(),
          shiftId: shift.id,
          workplaceId: shift.workplaceId,
          titleKey: 'notification.expectedTitle',
          bodyKey: 'notification.expectedBody',
        });
      }

      // Overdue escalation
      if (activePreferences.overdueShiftReminders) {
        for (const overdueOffset of OVERDUE_OFFSETS_MINUTES) {
          const overdueAt = addMinutes(expectedEndDate, overdueOffset);
          if (isAfter(overdueAt, now)) {
            const adjusted = adjustForQuietHours(overdueAt, activePreferences.quietHours, activePreferences.quietHours?.allowActiveShiftBypass ?? true, input.timezone);
            planned.push({
              logicalKey: `overdue_shift:${shift.id}:${overdueOffset}`,
              type: 'overdue_shift',
              scheduledFor: adjusted.toISOString(),
              shiftId: shift.id,
              workplaceId: shift.workplaceId,
              titleKey: 'notification.stillActiveTitle',
              bodyKey: 'notification.stillActiveBody',
              bodyParams: { minutesOverdue: overdueOffset },
            });
          }
        }
      }
    }

    // Long break reminder
    if (input.activeBreak && activePreferences.longBreakReminders) {
      const breakStart = parseISO(input.activeBreak.start);
      const isPaid = input.activeBreak.isPaid;
      const threshold = isPaid
        ? activePreferences.longPaidBreakThresholdMinutes
        : activePreferences.longUnpaidBreakThresholdMinutes;
      const breakAt = addMinutes(breakStart, threshold);
      if (isAfter(breakAt, now)) {
        const adjusted = adjustForQuietHours(breakAt, activePreferences.quietHours, activePreferences.quietHours?.allowActiveShiftBypass ?? true, input.timezone);
        planned.push({
          logicalKey: `long_break:${shift.id}:${input.activeBreak.id}`,
          type: 'long_break',
          scheduledFor: adjusted.toISOString(),
          shiftId: shift.id,
          breakSessionId: input.activeBreak.id,
          workplaceId: shift.workplaceId,
          titleKey: 'notification.longBreakTitle',
          bodyKey: 'notification.longBreakBody',
          bodyParams: { thresholdMinutes: threshold },
        });
      }
    }
  }

  // --- Compute diff against existing ---
  const existingByKey = new Map(input.existingRecords.map((r) => [r.logicalKey, r]));
  const plannedByKey = new Map(planned.map((n) => [n.logicalKey, n]));

  const cancellations: string[] = [];
  for (const existing of input.existingRecords) {
    if (!plannedByKey.has(existing.logicalKey)) {
      cancellations.push(existing.logicalKey);
    }
  }

  // Only include new or changed notifications
  const toSchedule: PlannedNotification[] = [];
  for (const notification of planned) {
    const existing = existingByKey.get(notification.logicalKey);
    if (!existing || !existing.nativeId || existing.scheduledFor !== notification.scheduledFor) {
      toSchedule.push(notification);
    }
  }

  return { notifications: toSchedule, cancellations };
}

// ---------------------------------------------------------------------------
// Quiet hours logic
// ---------------------------------------------------------------------------

/**
 * If the given time falls within quiet hours, delay it to after quiet hours end.
 * If bypass=true, return the original time unchanged.
 */
function adjustForQuietHours(time: Date, quietHours: QuietHours | undefined, bypass: boolean, timezone: string): Date {
  if (!quietHours || bypass) return time;

  const localH = getLocalHour(time, timezone);
  const localM = getLocalMinute(time, timezone);
  const timeMinutes = localH * 60 + localM;

  const [startH, startM] = quietHours.startTime.split(':').map(Number);
  const [endH, endM] = quietHours.endTime.split(':').map(Number);
  const quietStart = (startH ?? 0) * 60 + (startM ?? 0);
  const quietEnd = (endH ?? 0) * 60 + (endM ?? 0);

  const inQuiet = quietStart <= quietEnd
    ? timeMinutes >= quietStart && timeMinutes < quietEnd
    : timeMinutes >= quietStart || timeMinutes < quietEnd;

  if (!inQuiet) return time;

  // Delay to quiet hours end on the same or next day
  const targetDay = quietStart > quietEnd && timeMinutes >= quietStart
    ? addDays(time, 1)
    : time;

  const dateStr = format(targetDay, 'yyyy-MM-dd');
  return new Date(`${dateStr}T${quietHours.endTime}:00`);
}

function getLocalHour(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false });
    return Number(fmt.format(date));
  } catch { return date.getUTCHours(); }
}

function getLocalMinute(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, minute: '2-digit' });
    return Number(fmt.format(date));
  } catch { return date.getUTCMinutes(); }
}
