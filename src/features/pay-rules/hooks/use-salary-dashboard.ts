import { useEffect, useMemo, useState } from 'react';

import type { Shift } from '@/domain/entities';
import { SalaryCalculationCoordinator, type SalaryBatchResult } from '@/features/pay-rules/services/salary-calculation-coordinator';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';

export function useSalaryDashboard(shifts: readonly Shift[], calculatedAt: string, activeEnd?: string, reportingRange?: { start: string; end: string }) {
  const repositories = useRepositories();
  const coordinator = useMemo(() => new SalaryCalculationCoordinator(repositories), [repositories]);
  const reportingStart = reportingRange?.start; const reportingEnd = reportingRange?.end;
  const stableReportingRange = useMemo(() => reportingStart && reportingEnd ? { start: reportingStart, end: reportingEnd } : undefined, [reportingEnd, reportingStart]);
  const [summary, setSummary] = useState<SalaryBatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void coordinator.calculateMany(shifts, calculatedAt, activeEnd, { reportingRange: stableReportingRange }).then((value) => { if (current) { setSummary(value); setError(null); } })
      .catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : String(caught)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [activeEnd, calculatedAt, coordinator, shifts, stableReportingRange]);
  return { summary, loading, error, coordinator };
}
