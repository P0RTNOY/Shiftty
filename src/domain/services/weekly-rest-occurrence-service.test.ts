import { differenceInMinutes } from 'date-fns';

import { resolveWeeklyRestOccurrences } from '@/domain/services';
import { createWeeklyRestSchedule } from '@/test/fixtures';

describe('resolveWeeklyRestOccurrences', () => {
  it('returns no occurrence while the schedule is disabled', () => {
    expect(resolveWeeklyRestOccurrences(
      createWeeklyRestSchedule(),
      '2026-07-17T00:00:00+03:00',
      '2026-07-19T00:00:00+03:00',
      'Asia/Jerusalem',
    )).toEqual([]);
  });

  it('resolves only bounded overlapping occurrences on an alternative weekday', () => {
    const schedule = createWeeklyRestSchedule({
      id: 'monday-rest', startWeekday: 1, startTime: '20:00', endWeekday: 2, endTime: '08:00', enabled: true,
      confirmedAt: '2026-07-01T10:00:00+03:00',
    });
    const occurrences = resolveWeeklyRestOccurrences(schedule, '2026-07-20T21:00:00+03:00', '2026-07-21T07:00:00+03:00', 'Asia/Jerusalem');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      id: 'weekly-rest:monday-rest:2026-07-20', scheduleId: 'monday-rest', type: 'weekly_rest',
      start: '2026-07-20T20:00:00.000+03:00', end: '2026-07-21T08:00:00.000+03:00',
    });
  });

  it('uses elapsed time across the Jerusalem spring-forward transition', () => {
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5, startTime: '00:00', endWeekday: 5, endTime: '04:00', enabled: true,
      confirmedAt: '2026-03-01T10:00:00+02:00',
    });
    const [occurrence] = resolveWeeklyRestOccurrences(schedule, '2026-03-26T00:00:00+02:00', '2026-03-28T00:00:00+03:00', 'Asia/Jerusalem');
    expect(occurrence).toBeDefined();
    expect(differenceInMinutes(occurrence!.end, occurrence!.start)).toBe(180);
    expect(occurrence).toMatchObject({ start: '2026-03-27T00:00:00.000+02:00', end: '2026-03-27T04:00:00.000+03:00' });
  });

  it('moves a nonexistent spring-forward wall time to the first corresponding later time', () => {
    const schedule = createWeeklyRestSchedule({
      startWeekday: 5, startTime: '02:30', endWeekday: 5, endTime: '04:00', enabled: true,
      confirmedAt: '2026-03-01T10:00:00+02:00',
    });
    const [occurrence] = resolveWeeklyRestOccurrences(schedule, '2026-03-26T00:00:00+02:00', '2026-03-28T00:00:00+03:00', 'Asia/Jerusalem');
    expect(occurrence?.start).toBe('2026-03-27T03:30:00.000+03:00');
  });

  it('uses elapsed time across the Jerusalem fall-back transition', () => {
    const schedule = createWeeklyRestSchedule({
      startWeekday: 0, startTime: '00:00', endWeekday: 0, endTime: '04:00', enabled: true,
      confirmedAt: '2026-10-01T10:00:00+03:00',
    });
    const [occurrence] = resolveWeeklyRestOccurrences(schedule, '2026-10-24T00:00:00+03:00', '2026-10-26T00:00:00+02:00', 'Asia/Jerusalem');
    expect(occurrence).toBeDefined();
    expect(differenceInMinutes(occurrence!.end, occurrence!.start)).toBe(300);
    expect(occurrence).toMatchObject({ start: '2026-10-25T00:00:00.000+03:00', end: '2026-10-25T04:00:00.000+02:00' });
  });

  it('selects the earlier absolute occurrence of an ambiguous fall-back wall time', () => {
    const schedule = createWeeklyRestSchedule({
      startWeekday: 0, startTime: '01:30', endWeekday: 0, endTime: '03:30', enabled: true,
      confirmedAt: '2026-10-01T10:00:00+03:00',
    });
    const [occurrence] = resolveWeeklyRestOccurrences(schedule, '2026-10-24T00:00:00+03:00', '2026-10-26T00:00:00+02:00', 'Asia/Jerusalem');
    expect(occurrence?.start).toBe('2026-10-25T01:30:00.000+03:00');
  });
});
