import { addDays, differenceInCalendarWeeks, format, parseISO, subDays } from 'date-fns';

import type { RecurrenceRule, RecurrenceScope, RecurrenceSeries } from '@/domain/entities';
import { recurrenceSeriesSchema } from '@/domain/entities';
import { resolveLocalShiftRange } from '@/shared/utils/zoned-time';

export interface GeneratedRecurrenceOccurrence {
  id: string;
  localDate: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface GenerationState {
  existingLocalDates?: readonly string[];
  exceptionLocalDates?: readonly string[];
}

export type RecurrenceEditPlan =
  | { type: 'singleException'; seriesId: string; localDate: string }
  | { type: 'splitSeries'; seriesId: string; previousRule: RecurrenceRule; nextRule: RecurrenceRule }
  | { type: 'entireSeries'; seriesId: string };

export function generateRecurrenceOccurrences(
  input: RecurrenceSeries,
  windowStart: string,
  windowEnd: string,
  state: GenerationState = {},
): GeneratedRecurrenceOccurrence[] {
  const series = recurrenceSeriesSchema.parse(input);
  if (windowEnd < windowStart) {
    throw new Error('Recurrence generation window is invalid.');
  }

  const start = parseISO(series.rule.startsOn);
  const requestedEnd = parseISO(windowEnd);
  const maxEnd = addDays(parseISO(windowStart), 400);
  const end = requestedEnd.getTime() > maxEnd.getTime() ? maxEnd : requestedEnd;
  const persisted = new Set(state.existingLocalDates ?? []);
  const exceptions = new Set(state.exceptionLocalDates ?? []);
  const intervalWeeks = series.rule.frequency === 'weekly' ? 1 : 2;
  const results: GeneratedRecurrenceOccurrence[] = [];
  let occurrenceCount = 0;

  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    const localDate = format(cursor, 'yyyy-MM-dd');
    if (series.disabledFrom && localDate >= series.disabledFrom) {
      break;
    }
    if (series.rule.endsOn && localDate > series.rule.endsOn) {
      break;
    }
    const weekIndex = differenceInCalendarWeeks(cursor, start, { weekStartsOn: 0 });
    const matches = series.rule.weekdays.includes(cursor.getDay()) && weekIndex % intervalWeeks === 0;
    if (!matches) {
      continue;
    }

    occurrenceCount += 1;
    if (series.rule.occurrenceLimit && occurrenceCount > series.rule.occurrenceLimit) {
      break;
    }
    if (localDate < windowStart || persisted.has(localDate) || exceptions.has(localDate)) {
      continue;
    }

    const range = resolveLocalShiftRange(
      localDate,
      series.template.startTime,
      series.template.endTime,
      series.rule.timezone,
    );
    results.push({
      id: `${series.id}-${localDate.replaceAll('-', '')}`,
      localDate,
      scheduledStart: range.start,
      scheduledEnd: range.end,
    });
  }

  return results;
}

export function planRecurrenceEdit(
  series: RecurrenceSeries,
  localDate: string,
  scope: RecurrenceScope,
): RecurrenceEditPlan {
  if (scope === 'only') {
    return { type: 'singleException', seriesId: series.id, localDate };
  }
  if (scope === 'entire') {
    return { type: 'entireSeries', seriesId: series.id };
  }

  return {
    type: 'splitSeries',
    seriesId: series.id,
    previousRule: { ...series.rule, endsOn: format(subDays(parseISO(localDate), 1), 'yyyy-MM-dd') },
    nextRule: {
      ...series.rule,
      id: `${series.rule.id}-from-${localDate}`,
      startsOn: localDate,
      occurrenceLimit: undefined,
    },
  };
}
