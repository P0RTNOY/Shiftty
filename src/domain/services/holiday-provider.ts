import type { HolidayInterval } from '@/domain/entities';

export interface HolidayProvider {
  getHolidayIntervals(start: string, end: string, timezone: string): readonly HolidayInterval[];
}

export class StaticHolidayProvider implements HolidayProvider {
  constructor(private readonly intervals: readonly HolidayInterval[]) {}
  getHolidayIntervals(start: string, end: string, _timezone: string): readonly HolidayInterval[] {
    const from = Date.parse(start); const to = Date.parse(end);
    return this.intervals.filter((item) => Date.parse(item.start) < to && Date.parse(item.end) > from);
  }
}

export const NO_HOLIDAYS: HolidayProvider = { getHolidayIntervals: () => [] };
