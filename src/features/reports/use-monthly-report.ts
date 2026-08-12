import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { MonthlyReportService, type MonthlyReport } from '@/features/reports/monthly-report-service';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export function useMonthlyReport(month: string, timezone = 'Asia/Jerusalem') {
  const repositories = useRepositories();
  const service = useMemo(() => new MonthlyReportService(repositories), [repositories]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await service.load(month, timezone));
      setError(null);
    } catch (caught) {
      reportUnexpectedError('reports.monthly', caught);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [month, service, timezone]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { report, loading, error, refresh };
}
