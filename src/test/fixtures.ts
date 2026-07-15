import { shiftSchema, type BreakSession, type Shift } from '@/domain/entities';

export function createShift(overrides: Partial<Shift> = {}): Shift {
  return shiftSchema.parse({
    id: 'shift-1',
    workplaceId: 'workplace-1',
    scheduledStart: '2026-07-15T13:30:00+03:00',
    scheduledEnd: '2026-07-15T22:00:00+03:00',
    expectedBreakMinutes: 30,
    status: 'scheduled',
    hourlyRateSnapshotMinor: 4_500,
    timezone: 'Asia/Jerusalem',
    createdAt: '2026-07-01T10:00:00+03:00',
    updatedAt: '2026-07-01T10:00:00+03:00',
    ...overrides,
  });
}

export function createBreak(overrides: Partial<BreakSession> = {}): BreakSession {
  return {
    id: 'break-1',
    shiftId: 'shift-1',
    start: '2026-07-15T17:00:00+03:00',
    end: '2026-07-15T17:30:00+03:00',
    isPaid: false,
    source: 'tracked',
    createdAt: '2026-07-15T17:00:00+03:00',
    updatedAt: '2026-07-15T17:30:00+03:00',
    ...overrides,
  };
}
