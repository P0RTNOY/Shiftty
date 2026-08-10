import type { RecurrenceRepository, ShiftRepository, ShiftTemplateRepository } from '@/domain/repositories';
import { useAppStore } from '@/features/settings/store/app-store';
import { createShift } from '@/test/fixtures';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

describe('application bootstrap', () => {
  beforeEach(() => {
    useAppStore.setState({ activeShift: null, bootstrapError: null, bootstrapStatus: 'idle' });
  });

  it('extends recurrence from the authoritative series template and honors exceptions', async () => {
    const today = formatLocalDateKey(new Date(), 'Asia/Jerusalem');
    const weekday = new Date(`${today}T12:00:00+03:00`).getDay();
    const exceptionDate = addLocalDays(today, 7);
    const series = {
      id: 'series-1',
      rule: { id: 'rule-1', frequency: 'weekly' as const, weekdays: [weekday], startsOn: today, timezone: 'Asia/Jerusalem' },
      template: { workplaceId: 'workplace-1', startTime: '09:00', endTime: '17:00', expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 6_000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const existing = createShift({
      recurrenceGroupId: series.id,
      recurrenceOriginalStart: `${today}T09:00:00+03:00`,
      scheduledStart: `${today}T09:00:00+03:00`,
      scheduledEnd: `${today}T17:00:00+03:00`,
    });
    const shifts = {
      findActive: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue([existing]),
    } as unknown as ShiftRepository;
    const recurrence = {
      listAll: jest.fn().mockResolvedValue([series]),
      listExceptions: jest.fn().mockResolvedValue([{ id: 'exception-1', seriesId: series.id, localDate: exceptionDate, type: 'deleted', createdAt: new Date().toISOString() }]),
      materializeOccurrences: jest.fn().mockResolvedValue(undefined),
    } as unknown as RecurrenceRepository;
    const templates = { getById: jest.fn().mockResolvedValue(null) } as unknown as ShiftTemplateRepository;

    await useAppStore.getState().bootstrap({ shifts, recurrence, templates });

    expect(recurrence.listExceptions).toHaveBeenCalledWith(series.id);
    expect(recurrence.materializeOccurrences).toHaveBeenCalledTimes(1);
    expect(templates.getById).not.toHaveBeenCalled();
    const materialized = (recurrence.materializeOccurrences as jest.Mock).mock.calls[0]?.[1];
    expect(materialized.length).toBeGreaterThan(0);
    expect(materialized).not.toEqual(expect.arrayContaining([expect.objectContaining({ recurrenceOriginalStart: expect.stringContaining(exceptionDate) })]));
    expect(materialized[0]).toMatchObject({ recurrenceGroupId: series.id, expectedBreakMinutes: 0, hourlyRateSnapshotMinor: 6_000 });
  });
});

function addLocalDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
