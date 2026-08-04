import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Clock } from '@/shared/utils/clock';
import { systemClock } from '@/shared/utils/clock';

export function useLiveNow(clock: Clock = systemClock, refreshMilliseconds = 30_000): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const refresh = () => setNow(clock.now());
    const interval = setInterval(refresh, refreshMilliseconds);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [clock, refreshMilliseconds]);
  return now;
}
