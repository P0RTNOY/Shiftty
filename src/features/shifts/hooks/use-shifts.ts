import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Shift } from '@/domain/entities';
import type { ShiftQuery } from '@/domain/repositories';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';

export function useShifts(query: ShiftQuery = {}) {
  const { shifts: repository } = useRepositories();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusesKey = query.statuses?.join(',') ?? '';
  const startsBefore = query.startsBefore;
  const endsAfter = query.endsAfter;
  const workplaceId = query.workplaceId;
  const recurrenceGroupId = query.recurrenceGroupId;
  const rangeSource = query.rangeSource;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setShifts(await repository.list({
        startsBefore,
        endsAfter,
        workplaceId,
        recurrenceGroupId,
        rangeSource,
        statuses: statusesKey ? statusesKey.split(',') as Shift['status'][] : undefined,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [endsAfter, rangeSource, recurrenceGroupId, repository, startsBefore, statusesKey, workplaceId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { shifts, loading, error, refresh };
}

export function useShift(id: string | undefined) {
  const { shifts: repository } = useRepositories();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setShift(await repository.getById(id)); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); }
  }, [id, repository]);
  const clear = useCallback(() => setShift(null), []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { shift, loading, error, refresh, clear };
}
