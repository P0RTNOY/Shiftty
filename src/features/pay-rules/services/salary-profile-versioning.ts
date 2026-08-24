import type { SalaryProfile } from '@/domain/entities';

type CalculationProfileFields = Pick<SalaryProfile,
  | 'baseHourlyRateMinor'
  | 'workweekStartWeekday'
  | 'weeklyOvertimeEnabled'
  | 'weeklyRegularMinutes'
  | 'weeklyOvertimeMultiplierBasisPoints'
  | 'weeklyOvertimeBasis'>;

export function hasCalculationProfileChange(
  current: CalculationProfileFields,
  next: CalculationProfileFields,
): boolean {
  return current.baseHourlyRateMinor !== next.baseHourlyRateMinor
    || current.workweekStartWeekday !== next.workweekStartWeekday
    || current.weeklyOvertimeEnabled !== next.weeklyOvertimeEnabled
    || current.weeklyRegularMinutes !== next.weeklyRegularMinutes
    || current.weeklyOvertimeMultiplierBasisPoints !== next.weeklyOvertimeMultiplierBasisPoints
    || current.weeklyOvertimeBasis !== next.weeklyOvertimeBasis;
}
