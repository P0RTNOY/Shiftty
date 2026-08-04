import { act, renderHook } from '@testing-library/react-native';
import { useLiveNow } from '@/shared/hooks/use-live-now';
import type { Clock } from '@/shared/utils/clock';

it('uses a timer only to re-read the injected clock', () => {
  jest.useFakeTimers();
  const now = jest.fn().mockReturnValueOnce(new Date('2026-07-15T13:00:00Z')).mockReturnValue(new Date('2026-07-15T13:05:00Z'));
  const { result, unmount } = renderHook(() => useLiveNow({ now } satisfies Clock, 30_000));
  expect(result.current.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  act(() => jest.advanceTimersByTime(30_000));
  expect(result.current.toISOString()).toBe('2026-07-15T13:05:00.000Z');
  expect(now).toHaveBeenCalledTimes(2);
  unmount(); jest.useRealTimers();
});
