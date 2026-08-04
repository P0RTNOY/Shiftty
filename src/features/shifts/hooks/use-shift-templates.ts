import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { ShiftTemplate } from '@/domain/entities';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';

export function useShiftTemplates() {
  const { shiftTemplates: repository } = useRepositories();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const refresh = useCallback(async () => setTemplates(await repository.list()), [repository]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { templates, refresh };
}
