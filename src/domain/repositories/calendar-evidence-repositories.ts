import type { CalendarEvidenceInterval, WeeklyRestSchedule } from '@/domain/entities';

export interface EvidenceScopeQuery {
  workplaceId: string;
  salaryProfileId?: string;
  includeArchived?: boolean;
}

export interface EvidenceOverlapQuery extends EvidenceScopeQuery {
  start: string;
  end: string;
}

export interface CalendarEvidenceIntervalRepository {
  save(interval: CalendarEvidenceInterval): Promise<void>;
  getById(id: string): Promise<CalendarEvidenceInterval | null>;
  listForScope(query: EvidenceScopeQuery): Promise<CalendarEvidenceInterval[]>;
  listOverlapping(query: EvidenceOverlapQuery): Promise<CalendarEvidenceInterval[]>;
  archive(id: string, archivedAt: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WeeklyRestScheduleRepository {
  save(schedule: WeeklyRestSchedule): Promise<void>;
  getById(id: string): Promise<WeeklyRestSchedule | null>;
  getForProfile(profileId: string): Promise<WeeklyRestSchedule | null>;
  listForWorkplace(workplaceId: string, includeArchived?: boolean): Promise<WeeklyRestSchedule[]>;
  archive(id: string, archivedAt: string): Promise<void>;
  delete(id: string): Promise<void>;
}
