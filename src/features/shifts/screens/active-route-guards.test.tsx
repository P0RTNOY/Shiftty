import { router } from 'expo-router';
import { screen, waitFor } from '@testing-library/react-native';

import CancelActiveShiftScreen from '@/app/shifts/active/cancel';
import EndShiftReviewScreen from '@/app/shifts/active/end';
import ExpectedEndScreen from '@/app/shifts/active/expected-end';
import { renderApp } from '@/test/render';

const mockActiveHook = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/features/shifts/hooks/use-active-shift', () => ({ useActiveShift: () => mockActiveHook() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveHook.mockReturnValue({ activeShift: undefined, breaks: [], busy: false, loading: false });
});

it.each([
  ['clock-out review', EndShiftReviewScreen],
  ['active-shift cancellation', CancelActiveShiftScreen],
  ['expected-end editor', ExpectedEndScreen],
])('returns a stale %s route to Home when no shift is active', async (_name, Screen) => {
  renderApp(<Screen />);

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(screen.queryByRole('button', { name: 'ביטול המשמרת ושמירת זמני המעקב' })).toBeNull();
});
