import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { resolveLocalShiftRange, type ResolvedShiftRange } from '@/shared/utils/zoned-time';

export type ManualShiftRangeKind = 'completed' | 'scheduled' | 'overlapsNow';

interface Input {
  date: string;
  startTime: string;
  endTime: string;
  now: Date;
  timezone?: string;
}

export interface ManualShiftRangeClassification {
  kind: ManualShiftRangeKind;
  range: ResolvedShiftRange;
}

export function classifyManualShiftRange({ date, startTime, endTime, now, timezone = DEFAULT_TIMEZONE }: Input): ManualShiftRangeClassification {
  const range = resolveLocalShiftRange(date, startTime, endTime, timezone);
  const nowMs = now.getTime();
  const startMs = Date.parse(range.start);
  const endMs = Date.parse(range.end);
  const kind = endMs <= nowMs ? 'completed' : startMs > nowMs ? 'scheduled' : 'overlapsNow';
  return { kind, range };
}
