import { screen } from '@testing-library/react-native';

import NotificationSettingsScreen from '@/app/settings/notifications';
import type { NotificationPreferences } from '@/domain/entities/notification-preferences';
import { renderApp } from '@/test/render';

const mockReconcileAll = jest.fn().mockResolvedValue(undefined);
const mockRequestPermission = jest.fn().mockResolvedValue('granted');
const mockSave = jest.fn().mockResolvedValue(undefined);

const preferences: NotificationPreferences = {
  masterEnabled: true,
  scheduledShiftReminders: true,
  shiftReminderOffsets: [60, 15],
  missedClockInReminders: true,
  missedClockInGraceMinutes: 10,
  expectedEndReminders: true,
  overdueShiftReminders: true,
  longBreakReminders: true,
  longUnpaidBreakThresholdMinutes: 30,
  longPaidBreakThresholdMinutes: 60,
  dailySummaryEnabled: false,
  dailySummaryTime: '20:00',
};

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock('@/features/notifications/hooks/use-notification-settings', () => ({
  useNotificationSettings: () => ({
    preferences,
    permissionStatus: 'undetermined',
    loading: false,
    saving: false,
    error: false,
    save: mockSave,
    requestPermission: mockRequestPermission,
  }),
}));

jest.mock('@/features/shifts/hooks/use-notification-reconciler', () => ({
  useNotificationReconciler: () => ({ reconcileAll: mockReconcileAll }),
}));

it('exposes stable native-verification selectors for permission and reminder controls', () => {
  renderApp(<NotificationSettingsScreen />);

  expect(screen.getByTestId('e2e-notifications-enable')).toBeTruthy();
  expect(screen.getByTestId('notif_master_toggle')).toBeTruthy();
  expect(screen.getByTestId('e2e-notifications-scheduled')).toBeTruthy();
  expect(screen.getByTestId('e2e-notifications-missed')).toBeTruthy();
  expect(screen.getByTestId('e2e-notifications-expected-end')).toBeTruthy();
  expect(screen.getByTestId('e2e-notifications-overdue')).toBeTruthy();
  expect(screen.getByTestId('e2e-notifications-long-break')).toBeTruthy();

  for (const offset of [1440, 120, 60, 30, 15, 0]) {
    expect(screen.getByTestId(`e2e-notification-offset-${offset}`)).toBeTruthy();
  }
});
