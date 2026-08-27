import type * as Notifications from 'expo-notifications';

import type { ShiftRepository } from '@/domain/repositories';

const NOTIFICATION_OWNER = 'shifty';
const MAX_SHIFT_ID_LENGTH = 128;

export interface NotificationResponseNavigation {
  openShift(shiftId: string): void;
  openCalendar(): void;
}

interface NotificationResponseRouterDependencies {
  shifts: Pick<ShiftRepository, 'getById'>;
  navigation: NotificationResponseNavigation;
  clearLastResponse(): Promise<void>;
  reportError(error: unknown): void;
}

interface OwnedShiftResponse {
  responseKey: string;
  shiftId: string;
}

export function readOwnedShiftResponse(response: Notifications.NotificationResponse): OwnedShiftResponse | null {
  const data = response.notification.request.content.data;
  const shiftId = data?.shiftId;
  const responseKey = response.notification.request.identifier;

  if (data?.owner !== NOTIFICATION_OWNER) return null;
  if (typeof shiftId !== 'string' || shiftId.length === 0 || shiftId.length > MAX_SHIFT_ID_LENGTH) return null;
  if (typeof responseKey !== 'string' || responseKey.length === 0) return null;

  return { responseKey, shiftId };
}

export function createNotificationResponseRouter(dependencies: NotificationResponseRouterDependencies) {
  const handledResponseKeys = new Set<string>();

  return async (response: Notifications.NotificationResponse): Promise<boolean> => {
    const target = readOwnedShiftResponse(response);
    if (!target || handledResponseKeys.has(target.responseKey)) return false;

    handledResponseKeys.add(target.responseKey);
    try {
      const shift = await dependencies.shifts.getById(target.shiftId);
      if (shift) dependencies.navigation.openShift(target.shiftId);
      else dependencies.navigation.openCalendar();
      return true;
    } catch (error: unknown) {
      dependencies.reportError(error);
      return false;
    } finally {
      try {
        await dependencies.clearLastResponse();
      } catch (error: unknown) {
        dependencies.reportError(error);
      }
    }
  };
}
