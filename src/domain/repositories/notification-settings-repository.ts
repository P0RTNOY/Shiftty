import type { NotificationPreferences, WorkplaceNotificationOverride } from '@/domain/entities';

export interface NotificationSettingsRepository {
  getGlobal(): Promise<NotificationPreferences>;
  updateGlobal(preferences: NotificationPreferences): Promise<NotificationPreferences>;
  getWorkplaceOverride(workplaceId: string): Promise<WorkplaceNotificationOverride | null>;
  updateWorkplaceOverride(override: WorkplaceNotificationOverride): Promise<void>;
  clearWorkplaceOverride(workplaceId: string): Promise<void>;
}
