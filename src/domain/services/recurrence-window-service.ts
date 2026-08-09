/**
 * Recurrence Rolling-Window Service
 *
 * Maintains a materialized window of at least MIN_HORIZON_DAYS ahead.
 * When the horizon falls below MIN_HORIZON_DAYS, extends up to TARGET_HORIZON_DAYS.
 *
 * Requirements:
 * - Deterministic and idempotent
 * - Does not regenerate disabled/exception occurrences
 * - Respects disabledFrom, endsOn, occurrenceLimit
 * - Bounded: never generates more than TARGET_HORIZON_DAYS ahead
 */

import { addDays, format } from 'date-fns';

import type { RecurrenceSeries, RecurrenceException } from '@/domain/entities';
import { generateRecurrenceOccurrences } from './recurrence-service';

/** Minimum days ahead to maintain */
export const MIN_HORIZON_DAYS = 120;
/** Target days ahead to generate when extending */
export const TARGET_HORIZON_DAYS = 180;

export interface RollingWindowInput {
  series: RecurrenceSeries;
  existingLocalDates: readonly string[];
  exceptionLocalDates: readonly string[];
  now: Date;
}

export interface RollingWindowResult {
  needsExtension: boolean;
  occurrencesToCreate: ReturnType<typeof generateRecurrenceOccurrences>;
  newHorizonDate: string;
}

export function checkRollingWindow(input: RollingWindowInput): RollingWindowResult {
  const { series, existingLocalDates, exceptionLocalDates, now } = input;

  const latestExisting = existingLocalDates.length > 0
    ? existingLocalDates.reduce((a, b) => (a > b ? a : b))
    : format(now, 'yyyy-MM-dd');

  const minHorizon = format(addDays(now, MIN_HORIZON_DAYS), 'yyyy-MM-dd');
  const targetHorizon = format(addDays(now, TARGET_HORIZON_DAYS), 'yyyy-MM-dd');

  const needsExtension = latestExisting < minHorizon;

  if (!needsExtension) {
    return { needsExtension: false, occurrencesToCreate: [], newHorizonDate: latestExisting };
  }

  const windowStart = format(now, 'yyyy-MM-dd');
  const windowEnd = targetHorizon;

  const occurrencesToCreate = generateRecurrenceOccurrences(series, windowStart, windowEnd, {
    existingLocalDates: [...existingLocalDates],
    exceptionLocalDates: [...exceptionLocalDates],
  });

  const allDates = [...existingLocalDates, ...occurrencesToCreate.map((o) => o.localDate)];
  const newHorizonDate = allDates.length > 0
    ? allDates.reduce((a, b) => (a > b ? a : b))
    : latestExisting;

  return { needsExtension: true, occurrencesToCreate, newHorizonDate };
}

export function checkAllSeriesRollingWindows(
  allSeries: readonly { series: RecurrenceSeries; exceptions: RecurrenceException[] }[],
  shiftsBySeriesId: Map<string, readonly string[]>,
  now: Date,
): Map<string, RollingWindowResult> {
  const results = new Map<string, RollingWindowResult>();

  for (const { series, exceptions } of allSeries) {
    const existingLocalDates = shiftsBySeriesId.get(series.id) ?? [];
    const exceptionLocalDates = exceptions.map((e) => e.localDate);

    const result = checkRollingWindow({
      series,
      existingLocalDates,
      exceptionLocalDates,
      now,
    });

    results.set(series.id, result);
  }

  return results;
}
