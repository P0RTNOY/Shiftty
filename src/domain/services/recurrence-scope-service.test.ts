import { selectRecurrenceScopeOccurrences } from '@/domain/services/recurrence-scope-service';
import { createShift } from '@/test/fixtures';

const occurrences = [
  createShift({ id: 'a', recurrenceGroupId: 'series', scheduledStart: '2026-07-01T08:00:00+03:00', scheduledEnd: '2026-07-01T16:00:00+03:00' }),
  createShift({ id: 'b', recurrenceGroupId: 'series', scheduledStart: '2026-07-08T08:00:00+03:00', scheduledEnd: '2026-07-08T16:00:00+03:00' }),
  createShift({ id: 'c', recurrenceGroupId: 'series', scheduledStart: '2026-07-15T08:00:00+03:00', scheduledEnd: '2026-07-15T16:00:00+03:00' }),
];

describe('selectRecurrenceScopeOccurrences', () => {
  it('selects one occurrence only', () => expect(selectRecurrenceScopeOccurrences(occurrences, occurrences[1]!, 'only').map((item) => item.id)).toEqual(['b']));
  it('selects the target and future occurrences', () => expect(selectRecurrenceScopeOccurrences(occurrences, occurrences[1]!, 'future').map((item) => item.id)).toEqual(['b', 'c']));
  it('selects the entire series', () => expect(selectRecurrenceScopeOccurrences(occurrences, occurrences[1]!, 'entire').map((item) => item.id)).toEqual(['a', 'b', 'c']));
});
