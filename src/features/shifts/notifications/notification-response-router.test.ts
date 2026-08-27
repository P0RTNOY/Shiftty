import type * as Notifications from 'expo-notifications';

import {
  createNotificationResponseRouter,
  readOwnedShiftResponse,
} from '@/features/shifts/notifications/notification-response-router';

function response(data: Record<string, unknown>, identifier = 'native-response-1'): Notifications.NotificationResponse {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: Date.now(),
      request: {
        identifier,
        content: {
          title: null,
          subtitle: null,
          body: null,
          data,
          sound: null,
          categoryIdentifier: null,
        },
        trigger: null,
      },
    },
  };
}

describe('notification response routing', () => {
  it('accepts only owned responses with a bounded shift reference', () => {
    expect(readOwnedShiftResponse(response({ owner: 'shifty', shiftId: 'shift-1' }))).toEqual({
      responseKey: 'native-response-1',
      shiftId: 'shift-1',
    });
    expect(readOwnedShiftResponse(response({ owner: 'other', shiftId: 'shift-1' }))).toBeNull();
    expect(readOwnedShiftResponse(response({ owner: 'shifty' }))).toBeNull();
    expect(readOwnedShiftResponse(response({ owner: 'shifty', shiftId: 'x'.repeat(129) }))).toBeNull();
  });

  it('routes an existing shift exactly once and clears the cold-start response', async () => {
    const shifts = { getById: jest.fn().mockResolvedValue({ id: 'shift-1' }) };
    const navigation = { openShift: jest.fn(), openCalendar: jest.fn() };
    const clearLastResponse = jest.fn().mockResolvedValue(undefined);
    const reportError = jest.fn();
    const route = createNotificationResponseRouter({ shifts, navigation, clearLastResponse, reportError });
    const notificationResponse = response({ owner: 'shifty', shiftId: 'shift-1' });

    await expect(route(notificationResponse)).resolves.toBe(true);
    await expect(route(notificationResponse)).resolves.toBe(false);

    expect(shifts.getById).toHaveBeenCalledTimes(1);
    expect(navigation.openShift).toHaveBeenCalledWith('shift-1');
    expect(navigation.openCalendar).not.toHaveBeenCalled();
    expect(clearLastResponse).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('routes stale or missing shift references safely to the calendar', async () => {
    const shifts = { getById: jest.fn().mockResolvedValue(null) };
    const navigation = { openShift: jest.fn(), openCalendar: jest.fn() };
    const route = createNotificationResponseRouter({
      shifts,
      navigation,
      clearLastResponse: jest.fn().mockResolvedValue(undefined),
      reportError: jest.fn(),
    });

    await expect(route(response({ owner: 'shifty', shiftId: 'deleted-shift' }))).resolves.toBe(true);
    expect(navigation.openCalendar).toHaveBeenCalledTimes(1);
    expect(navigation.openShift).not.toHaveBeenCalled();
  });

  it('reports lookup and response-clearing errors without exposing payload data', async () => {
    const lookupError = new Error('lookup failed');
    const clearError = new Error('clear failed');
    const reportError = jest.fn();
    const route = createNotificationResponseRouter({
      shifts: { getById: jest.fn().mockRejectedValue(lookupError) },
      navigation: { openShift: jest.fn(), openCalendar: jest.fn() },
      clearLastResponse: jest.fn().mockRejectedValue(clearError),
      reportError,
    });

    await expect(route(response({ owner: 'shifty', shiftId: 'shift-1' }))).resolves.toBe(false);
    expect(reportError).toHaveBeenNthCalledWith(1, lookupError);
    expect(reportError).toHaveBeenNthCalledWith(2, clearError);
  });
});
