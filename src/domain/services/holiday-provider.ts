import { calendarEvidenceIntervalSchema, type CalendarEvidenceInterval, type HolidayInterval } from '@/domain/entities';

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

export interface CalendarEvidenceQuery {
  start: string;
  end: string;
  workplaceId: string;
  salaryProfileId?: string;
}

export interface CalendarEvidenceProvider {
  getCalendarEvidenceIntervals(query: CalendarEvidenceQuery): Promise<readonly CalendarEvidenceInterval[]>;
}

/** A deterministic offline provider useful for composition and focused tests. */
export class StaticCalendarEvidenceProvider implements CalendarEvidenceProvider {
  private readonly intervals: readonly CalendarEvidenceInterval[];
  constructor(intervals: readonly CalendarEvidenceInterval[]) {
    this.intervals = intervals.map((interval) => calendarEvidenceIntervalSchema.parse(interval));
  }
  async getCalendarEvidenceIntervals(query: CalendarEvidenceQuery): Promise<readonly CalendarEvidenceInterval[]> {
    const from = Date.parse(query.start); const to = Date.parse(query.end);
    return this.intervals.filter((interval) => !interval.isArchived
      && interval.workplaceId === query.workplaceId
      && (!interval.salaryProfileId || interval.salaryProfileId === query.salaryProfileId)
      && Date.parse(interval.start) < to
      && Date.parse(interval.end) > from)
      .sort((left, right) => Date.parse(left.start) - Date.parse(right.start)
        || Date.parse(left.end) - Date.parse(right.end)
        || left.type.localeCompare(right.type)
        || left.id.localeCompare(right.id));
  }
}

export const NO_CALENDAR_EVIDENCE: CalendarEvidenceProvider = {
  getCalendarEvidenceIntervals: async () => [],
};
