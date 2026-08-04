import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { BreakSession, Shift } from '@/domain/entities';
import { buildActiveNotificationPlan, type ActiveNotificationKind } from '@/domain/services/active-notification-service';
import { activeNotificationCopy } from '@/shared/i18n/translations-phase3';
import type { SupportedLocale } from '@/shared/i18n';

export class ActiveShiftNotifications {
  async schedule(shift: Shift, activeBreak: BreakSession | undefined, now: Date, locale: SupportedLocale = 'he'): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'undetermined') permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return false;
    await this.cancelForShift(shift.id);
    for (const item of buildActiveNotificationPlan(shift, activeBreak, now)) {
      await Notifications.scheduleNotificationAsync({ content: { ...activeNotificationCopy[locale][item.kind as ActiveNotificationKind], data: { owner: 'shifty-active', shiftId: item.shiftId, breakId: item.breakId, kind: item.kind } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at) } });
    }
    return true;
  }

  async cancelForShift(shiftId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((item) => item.content.data?.owner === 'shifty-active' && item.content.data?.shiftId === shiftId).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  }
}
