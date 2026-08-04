import { StaticHolidayProvider } from '@/domain/services/holiday-provider';

it('returns only locally supplied holiday intervals that overlap the requested range', () => {
  const provider = new StaticHolidayProvider([{ id: 'inside', name: 'Configured holiday', start: '2026-07-15T18:00:00+03:00', end: '2026-07-16T18:00:00+03:00' }, { id: 'outside', name: 'Other', start: '2026-08-01T00:00:00+03:00', end: '2026-08-02T00:00:00+03:00' }]);
  expect(provider.getHolidayIntervals('2026-07-15T08:00:00+03:00', '2026-07-16T08:00:00+03:00', 'Asia/Jerusalem').map((item) => item.id)).toEqual(['inside']);
});
