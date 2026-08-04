import { buildNotificationPlan } from '@/domain/services/notification-planner';
import type { NotificationPlannerInput } from '@/domain/services/notification-planner';
import type { Shift } from '@/domain/entities';
import type { ResolvedNotificationPreferences } from '@/domain/entities/notification-preferences';

const TIMEZONE = 'Asia/Jerusalem';
const NOW = new Date('2026-08-04T09:00:00+03:00'); // 09:00 local time

const DEFAULT_PREFS: ResolvedNotificationPreferences = {
  masterEnabled: true,
  scheduledShiftReminders: true,
  shiftReminderOffsets: [60, 15],
  missedClockInReminders: true,
  missedClockInGraceMinutes: 10,
  expectedEndReminders: true,
  overdueShiftReminders: true,
  longBreakReminders: true,
  longUnpaidBreakThresholdMinutes: 30,
  longPaidBreakThresholdMinutes: 60,
};

const UPCOMING_SHIFT: Shift = {
  id: 'shift-1',
  status: 'scheduled',
  workplaceId: 'wp-1',
  scheduledStart: '2026-08-04T11:00:00+03:00', // 11:00 → 2h from now
  scheduledEnd: '2026-08-04T19:00:00+03:00',
  expectedBreakMinutes: 30,
  hourlyRateSnapshotMinor: 3000,
  salaryCalculationStatus: 'not_calculated',
  timezone: TIMEZONE,
  createdAt: '2026-01-01T00:00:00+03:00',
  updatedAt: '2026-01-01T00:00:00+03:00',
};

function makeInput(overrides: Partial<NotificationPlannerInput> = {}): NotificationPlannerInput {
  return {
    now: NOW,
    timezone: TIMEZONE,
    upcomingShifts: [UPCOMING_SHIFT],
    activeShift: null,
    activeBreak: null,
    preferences: DEFAULT_PREFS,
    existingRecords: [],
    ...overrides,
  };
}

describe('buildNotificationPlan', () => {
  it('schedules 60-minute and 15-minute reminders for an upcoming shift', () => {
    const plan = buildNotificationPlan(makeInput());
    const keys = plan.notifications.map((n) => n.logicalKey);
    expect(keys).toContain('shift_reminder:shift-1:60');
    expect(keys).toContain('shift_reminder:shift-1:15');
  });

  it('schedules missed clock-in reminder after grace period', () => {
    const plan = buildNotificationPlan(makeInput());
    const missedClockIn = plan.notifications.find((n) => n.type === 'missed_clock_in');
    expect(missedClockIn).toBeDefined();
    expect(missedClockIn?.logicalKey).toBe('missed_clock_in:shift-1');
    // Should fire at scheduledStart + 10 min = 11:10
    expect(missedClockIn?.scheduledFor).toContain('08:10');
  });

  it('does not schedule reminders for a shift in the past', () => {
    const pastShift: Shift = {
      ...UPCOMING_SHIFT,
      scheduledStart: '2026-08-04T07:00:00+03:00',
      scheduledEnd: '2026-08-04T08:00:00+03:00',
    };
    const plan = buildNotificationPlan(makeInput({ upcomingShifts: [pastShift] }));
    expect(plan.notifications.filter((n) => n.type === 'shift_reminder')).toHaveLength(0);
  });

  it('cancels everything when masterEnabled is false', () => {
    const existingRecord = {
      logicalKey: 'shift_reminder:shift-1:60',
      type: 'shift_reminder' as const,
      scheduledFor: '2026-08-04T10:00:00+03:00',
      shiftId: 'shift-1',
      titleKey: 'notification.shiftReminderTitle',
      bodyKey: 'notification.shiftReminderBody',
      createdAt: '2026-01-01T00:00:00+03:00',
      updatedAt: '2026-01-01T00:00:00+03:00',
    };
    const plan = buildNotificationPlan(makeInput({
      preferences: { ...DEFAULT_PREFS, masterEnabled: false },
      existingRecords: [existingRecord],
    }));
    expect(plan.notifications).toHaveLength(0);
    expect(plan.cancellations).toContain('shift_reminder:shift-1:60');
  });

  it('generates cancellations for obsolete logical keys', () => {
    const existingRecord = {
      logicalKey: 'shift_reminder:old-shift:60',
      type: 'shift_reminder' as const,
      scheduledFor: '2026-08-04T10:00:00+03:00',
      shiftId: 'old-shift',
      titleKey: 'notification.shiftReminderTitle',
      bodyKey: 'notification.shiftReminderBody',
      createdAt: '2026-01-01T00:00:00+03:00',
      updatedAt: '2026-01-01T00:00:00+03:00',
    };
    const plan = buildNotificationPlan(makeInput({ existingRecords: [existingRecord] }));
    expect(plan.cancellations).toContain('shift_reminder:old-shift:60');
  });

  it('skips duplicate scheduling when scheduledFor has not changed', () => {
    const fixedScheduledFor = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    const existingRecord = {
      logicalKey: 'shift_reminder:shift-1:60',
      type: 'shift_reminder' as const,
      scheduledFor: fixedScheduledFor,
      shiftId: 'shift-1',
      titleKey: 'notification.shiftReminderTitle',
      bodyKey: 'notification.shiftReminderBody',
      createdAt: '2026-01-01T00:00:00+03:00',
      updatedAt: '2026-01-01T00:00:00+03:00',
    };
    const plan = buildNotificationPlan(makeInput({ existingRecords: [existingRecord] }));
    expect(plan.notifications.find((n) => n.logicalKey === 'shift_reminder:shift-1:60')).toBeUndefined();
  });

  it('respects shift reminder disabled preference', () => {
    const plan = buildNotificationPlan(makeInput({
      preferences: { ...DEFAULT_PREFS, scheduledShiftReminders: false },
    }));
    expect(plan.notifications.filter((n) => n.type === 'shift_reminder')).toHaveLength(0);
  });
});
