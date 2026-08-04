import type { ScheduledNotificationRecord } from '@/domain/entities';

export interface UpsertScheduledNotificationInput {
  logicalKey: string;
  type: ScheduledNotificationRecord['type'];
  scheduledFor: string;
  shiftId?: string;
  breakSessionId?: string;
  workplaceId?: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  nativeId?: string;
}

export interface ScheduledNotificationRepository {
  listAll(): Promise<ScheduledNotificationRecord[]>;
  listByShiftId(shiftId: string): Promise<ScheduledNotificationRecord[]>;
  getByLogicalKey(logicalKey: string): Promise<ScheduledNotificationRecord | null>;
  upsert(input: UpsertScheduledNotificationInput): Promise<void>;
  deleteByLogicalKey(logicalKey: string): Promise<void>;
  deleteByShiftId(shiftId: string): Promise<void>;
  updateNativeId(logicalKey: string, nativeId: string): Promise<void>;
}
