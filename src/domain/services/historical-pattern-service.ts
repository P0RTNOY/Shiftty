/**
 * Historical Pattern Service — deterministic, no ML.
 *
 * Algorithm:
 * 1. Load bounded window of recent completed shifts (caller provides)
 * 2. Group by (workplaceId, roleId?, weekday)
 * 3. For each group with >= MIN_OBSERVATIONS: compute median start, median end, median break
 * 4. Return pattern candidates
 *
 * Time clustering tolerance: 30 minutes (CLUSTER_TOLERANCE_MINUTES)
 * Minimum observations: 3 (MIN_OBSERVATIONS)
 * History window: caller should supply last 90 days max
 */

import { getDay, parseISO } from 'date-fns';

import type { Shift } from '@/domain/entities';
import type { HistoricalPattern } from './shift-prediction-engine';

const MIN_OBSERVATIONS = 3;
const CLUSTER_TOLERANCE_MINUTES = 30;

interface GroupKey {
  workplaceId: string;
  roleId: string | null;
  weekday: number;
}

type TimeMinutes = number; // minutes since midnight, 0–1439

function groupKeyString(key: GroupKey): string {
  return `${key.workplaceId}__${key.roleId ?? 'none'}__${key.weekday}`;
}

function minutesToLocalTime(minutes: TimeMinutes): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function extractLocalTime(isoTs: string, timezone: string): TimeMinutes {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date(isoTs));
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return 0;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

/**
 * Clusters a set of time values (minutes since midnight) within a tolerance.
 * Returns the largest cluster's median.
 */
function dominantClusterMedian(times: TimeMinutes[]): TimeMinutes {
  if (times.length === 0) return 0;
  // Simple greedy clustering: sort, then group within tolerance
  const sorted = [...times].sort((a, b) => a - b);
  const clusters: TimeMinutes[][] = [];
  let current: TimeMinutes[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i]! - current[0]!) <= CLUSTER_TOLERANCE_MINUTES) {
      current.push(sorted[i]!);
    } else {
      clusters.push(current);
      current = [sorted[i]!];
    }
  }
  clusters.push(current);

  const largest = clusters.reduce((a, b) => (b.length > a.length ? b : a));
  return median(largest);
}

export function detectHistoricalPatterns(
  recentCompletedShifts: readonly Shift[],
  timezone: string,
): HistoricalPattern[] {
  const groups = new Map<string, { key: GroupKey; startTimes: TimeMinutes[]; endTimes: TimeMinutes[]; breakMinutes: number[] }>();

  for (const shift of recentCompletedShifts) {
    if (shift.status !== 'completed') continue;
    if (!shift.actualStart || !shift.actualEnd) continue;

    const weekday = getDay(parseISO(shift.actualStart));
    const key: GroupKey = {
      workplaceId: shift.workplaceId,
      roleId: shift.roleId ?? null,
      weekday,
    };
    const keyStr = groupKeyString(key);

    if (!groups.has(keyStr)) {
      groups.set(keyStr, { key, startTimes: [], endTimes: [], breakMinutes: [] });
    }
    const group = groups.get(keyStr)!;
    group.startTimes.push(extractLocalTime(shift.actualStart, timezone));
    group.endTimes.push(extractLocalTime(shift.actualEnd, timezone));
    group.breakMinutes.push(shift.actualBreakMinutes ?? 0);
  }

  const patterns: HistoricalPattern[] = [];

  for (const [, group] of groups) {
    if (group.startTimes.length < MIN_OBSERVATIONS) continue;

    const medianStart = dominantClusterMedian(group.startTimes);
    const medianEnd = dominantClusterMedian(group.endTimes);
    const medianBreak = median(group.breakMinutes);

    patterns.push({
      workplaceId: group.key.workplaceId,
      roleId: group.key.roleId ?? undefined,
      weekday: group.key.weekday,
      medianStartTime: minutesToLocalTime(medianStart),
      medianEndTime: minutesToLocalTime(medianEnd),
      medianBreakMinutes: medianBreak,
      observationCount: group.startTimes.length,
      patternId: groupKeyString(group.key),
    });
  }

  return patterns;
}
