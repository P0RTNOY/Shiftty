import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { ShiftTemplate } from '@/domain/entities';
import { SqliteShiftTemplateRepository } from '@/data/repositories';

export function useTemplates(includeArchived = false) {
  const database = useSQLiteContext();
  const repo = new SqliteShiftTemplateRepository(database);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = includeArchived
        ? await repo.listIncludingArchived()
        : await repo.listActive();
      setTemplates(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const archive = useCallback(async (id: string) => {
    await repo.archive(id);
    await refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const restore = useCallback(async (id: string) => {
    await repo.restore(id);
    await refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await repo.delete(id);
    await refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const duplicate = useCallback(async (id: string, newName: string) => {
    await repo.duplicate(id, newName);
    await refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return { templates, loading, error, refresh, archive, restore, remove, duplicate };
}
