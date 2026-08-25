import { StaticCalendarEvidenceProvider, StaticHolidayProvider } from '@/domain/services/holiday-provider';
import { createCalendarEvidenceInterval } from '@/test/fixtures';

it('returns only locally supplied holiday intervals that overlap the requested range', () => {
  const provider = new StaticHolidayProvider([{ id: 'inside', name: 'Configured holiday', start: '2026-07-15T18:00:00+03:00', end: '2026-07-16T18:00:00+03:00' }, { id: 'outside', name: 'Other', start: '2026-08-01T00:00:00+03:00', end: '2026-08-02T00:00:00+03:00' }]);
  expect(provider.getHolidayIntervals('2026-07-15T08:00:00+03:00', '2026-07-16T08:00:00+03:00', 'Asia/Jerusalem').map((item) => item.id)).toEqual(['inside']);
});

it('filters generalized evidence by half-open range, workplace, profile, and archive state', async () => {
  const inside = createCalendarEvidenceInterval();
  const provider = new StaticCalendarEvidenceProvider([
    inside,
    createCalendarEvidenceInterval({ id: 'foreign-workplace', workplaceId: 'workplace-2' }),
    createCalendarEvidenceInterval({ id: 'foreign-profile', salaryProfileId: 'profile-2' }),
    createCalendarEvidenceInterval({ id: 'archived', isArchived: true, archivedAt: '2026-07-02T10:00:00+03:00' }),
  ]);
  const result = await provider.getCalendarEvidenceIntervals({
    start: inside.start, end: inside.end, workplaceId: inside.workplaceId, salaryProfileId: inside.salaryProfileId,
  });
  expect(result.map((interval) => interval.id)).toEqual([inside.id]);
});
