import { AppState } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import { NotificationLifecycle } from '@/features/shifts/components/notification-lifecycle';

const mockReconcileAll = jest.fn().mockResolvedValue(undefined);
let mockPathname = '/';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/features/shifts/hooks/use-notification-reconciler', () => ({
  useNotificationReconciler: () => ({ reconcileAll: mockReconcileAll }),
}));

describe('NotificationLifecycle', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockReconcileAll.mockClear();
  });

  it('reconciles on startup and after navigation mutations', async () => {
    const view = render(<NotificationLifecycle />);
    await waitFor(() => expect(mockReconcileAll).toHaveBeenCalledTimes(1));

    mockPathname = '/shifts/created';
    view.rerender(<NotificationLifecycle />);

    await waitFor(() => expect(mockReconcileAll).toHaveBeenCalledTimes(2));
  });

  it('reconciles when the app returns to the foreground', async () => {
    let onStateChange: ((state: string) => void) | undefined;
    const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      onStateChange = callback as (state: string) => void;
      return { remove: jest.fn() };
    });
    render(<NotificationLifecycle />);
    await waitFor(() => expect(mockReconcileAll).toHaveBeenCalledTimes(1));

    act(() => onStateChange?.('active'));
    await waitFor(() => expect(mockReconcileAll).toHaveBeenCalledTimes(2));
    listener.mockRestore();
  });
});
