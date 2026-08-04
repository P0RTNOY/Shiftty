import { buildActiveNotificationPlan } from '@/domain/services/active-notification-service';
import { createBreak, createShift } from '@/test/fixtures';

it('builds deterministic expected-end and long-break reminders', () => {
  const shift = createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', expectedEnd: '2026-07-15T22:00:00+03:00', activeOrigin: 'scheduled' });
  const plan = buildActiveNotificationPlan(shift, createBreak({ end: undefined, start: '2026-07-15T17:00:00+03:00' }), new Date('2026-07-15T16:00:00+03:00'));
  expect(plan.map((item) => item.kind)).toEqual(['expected-end-soon', 'expected-end', 'still-active', 'long-break']);
  expect(plan.find((item) => item.kind === 'long-break')?.at).toBe('2026-07-15T14:30:00.000Z');
});

it('omits reminders that are already in the past or have no expected end', () => {
  const shift = createShift({ status: 'active', scheduledStart: undefined, scheduledEnd: undefined, actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'unscheduled' });
  expect(buildActiveNotificationPlan(shift, undefined, new Date('2026-07-15T16:00:00+03:00'))).toEqual([]);
});
