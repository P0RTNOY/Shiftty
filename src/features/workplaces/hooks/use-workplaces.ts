import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Role, Workplace } from '@/domain/entities';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export function useWorkplaces() {
  const { workplaces: repository } = useRepositories();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextWorkplaces = await repository.list();
      setWorkplaces(nextWorkplaces);
      setRoles((await Promise.all(nextWorkplaces.map((workplace) => repository.listRoles(workplace.id)))).flat());
      setError(null);
    }
    catch (caught) { reportUnexpectedError('workplaces.list', caught); setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); }
  }, [repository]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { workplaces, roles, loading, error, refresh, repository };
}
