import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getDay } from 'date-fns';

import type { ShiftPredictionResult } from '@/domain/entities/prediction';
import { SqliteShiftRepository, SqliteShiftTemplateRepository, SqlitePredictionFeedbackRepository } from '@/data/repositories';
import { orchestratePrediction } from '@/features/shifts/services/prediction-orchestrator';
import { useAppStore } from '@/features/settings/store/app-store';

export function useShiftPrediction(selectedWorkplaceId?: string, selectedRoleId?: string) {
  const database = useSQLiteContext();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jerusalem';

  const [result, setResult] = useState<ShiftPredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const prediction = await orchestratePrediction(
        { now, timezone, selectedWorkplaceId, selectedRoleId },
        {
          shifts: new SqliteShiftRepository(database),
          templates: new SqliteShiftTemplateRepository(database),
          feedback: new SqlitePredictionFeedbackRepository(database),
        },
      );
      setResult(prediction);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [database, timezone, selectedWorkplaceId, selectedRoleId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return { result, loading, error, refresh };
}
