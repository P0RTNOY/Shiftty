import {
  createActiveShift,
  createCompletedShift,
  createScheduledShift,
  isCompletedShiftFutureDated,
} from '@/domain/services/shift-factory';

const context = {
  id: 'shift-new',
  now: '2026-08-03T10:00:00+03:00',
  timezone: 'Asia/Jerusalem',
};

describe('shift factories', () => {
  it('creates an unscheduled active shift from safe workplace defaults', () => {
    const shift = createActiveShift({
      workplace: {
        id: 'workplace-1',
        name: 'Cafe',
        defaultHourlyRateMinor: 5_000,
        defaultBreakMinutes: 30,
        createdAt: '2026-01-01T00:00:00+02:00',
        updatedAt: '2026-01-01T00:00:00+02:00',
      },
    }, context);

    expect(shift).toMatchObject({
      workplaceId: 'workplace-1',
      status: 'active',
      activeOrigin: 'unscheduled',
      actualStart: context.now,
      expectedBreakMinutes: 30,
      hourlyRateSnapshotMinor: 5_000,
    });
    expect(shift.scheduledStart).toBeUndefined();
    expect(shift.payableStart).toBeUndefined();
  });

  it('creates a cross-midnight scheduled shift without populating worked ranges', () => {
    const shift = createScheduledShift(
      {
        date: '2026-08-05',
        startTime: '22:00',
        endTime: '06:00',
        workplaceId: 'workplace-1',
        expectedBreakMinutes: 30,
        hourlyRateSnapshotMinor: 4500,
      },
      context,
    );

    expect(shift.status).toBe('scheduled');
    expect(shift.scheduledEnd).toContain('2026-08-06T06:00');
    expect(shift.actualStart).toBeUndefined();
    expect(shift.payableStart).toBeUndefined();
  });

  it('creates a completed shift with no known scheduled range', () => {
    const shift = createCompletedShift(
      {
        date: '2026-08-01',
        actualStartTime: '13:24',
        actualEndTime: '22:07',
        payableStartTime: '13:30',
        payableEndTime: '22:00',
        actualBreakMinutes: 42,
        payableBreakMinutes: 30,
        workplaceId: 'workplace-1',
        hourlyRateSnapshotMinor: 4500,
      },
      context,
    );

    expect(shift.status).toBe('completed');
    expect(shift.scheduledStart).toBeUndefined();
    expect(shift.actualStart).not.toBe(shift.payableStart);
  });

  it('mirrors actual times into payable defaults', () => {
    const shift = createCompletedShift(
      {
        date: '2026-08-01',
        actualStartTime: '13:24',
        actualEndTime: '22:07',
        actualBreakMinutes: 30,
        payableBreakMinutes: 30,
        workplaceId: 'workplace-1',
        hourlyRateSnapshotMinor: 0,
      },
      context,
    );

    expect(shift.payableStart).toBe(shift.actualStart);
    expect(shift.payableEnd).toBe(shift.actualEnd);
  });

  it('rejects breaks longer than their corresponding duration', () => {
    expect(() =>
      createCompletedShift(
        {
          date: '2026-08-01',
          actualStartTime: '10:00',
          actualEndTime: '11:00',
          actualBreakMinutes: 61,
          payableBreakMinutes: 0,
          workplaceId: 'workplace-1',
          hourlyRateSnapshotMinor: 0,
        },
        context,
      ),
    ).toThrow('Actual break');
  });

  it('identifies accidentally future-dated completed work', () => {
    const shift = createCompletedShift(
      {
        date: '2026-08-04',
        actualStartTime: '10:00',
        actualEndTime: '11:00',
        actualBreakMinutes: 0,
        payableBreakMinutes: 0,
        workplaceId: 'workplace-1',
        hourlyRateSnapshotMinor: 0,
      },
      context,
    );

    expect(isCompletedShiftFutureDated(shift, new Date(context.now))).toBe(true);
  });
});
