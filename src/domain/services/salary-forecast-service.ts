import type { PayRule, Role, SalaryProfile, Shift, Workplace } from '@/domain/entities';
import { calculateSalary } from './salary-calculation-service';

export interface MonthlyEarningsDependencies {
  profilesByWorkplace: Readonly<Record<string, SalaryProfile>>;
  rulesByProfile: Readonly<Record<string, readonly PayRule[]>>;
  rolesById: Readonly<Record<string, Role>>;
  workplacesById: Readonly<Record<string, Workplace>>;
  calculatedAt: string;
}

export interface MonthlyEarningsSummary {
  earnedMinor: number;
  futureMinor: number;
  forecastMinor: number;
  incompleteShiftCount: number;
  regularMinutes: number;
  specialRateMinutes: number;
  resultsByShiftId: Readonly<Record<string, ReturnType<typeof calculateSalary>>>;
}

export function calculateMonthlyEarnings(shifts: readonly Shift[], dependencies: MonthlyEarningsDependencies): MonthlyEarningsSummary {
  let earnedMinor = 0; let futureMinor = 0; let incompleteShiftCount = 0; let regularMinutes = 0; let specialRateMinutes = 0;
  const resultsByShiftId: Record<string, ReturnType<typeof calculateSalary>> = {};
  const priorWorkedMinutesByLocalDate: Record<string, number> = {};
  const relevant = shifts.filter((shift) => shift.status === 'completed' || shift.status === 'scheduled').sort((a, b) => Date.parse(a.payableStart ?? a.scheduledStart ?? '') - Date.parse(b.payableStart ?? b.scheduledStart ?? ''));
  for (const shift of relevant) {
    const profile = dependencies.profilesByWorkplace[shift.workplaceId];
    const role = shift.roleId ? dependencies.rolesById[shift.roleId] : undefined;
    const workplace = dependencies.workplacesById[shift.workplaceId];
    const result = calculateSalary({
      shift, profile, rules: profile ? dependencies.rulesByProfile[profile.id] ?? [] : [], breaks: [], holidayIntervals: [],
      calculatedAt: dependencies.calculatedAt, roleHourlyRateMinor: role?.hourlyRateMinor,
      workplaceHourlyRateMinor: workplace?.defaultHourlyRateMinor, priorWorkedMinutesByLocalDate,
    });
    resultsByShiftId[shift.id] = result;
    if (result.totalGrossPayMinor === undefined) incompleteShiftCount += 1;
    else if (shift.status === 'completed') earnedMinor += result.totalGrossPayMinor;
    else futureMinor += result.totalGrossPayMinor;
    regularMinutes += result.regularMinutes; specialRateMinutes += result.specialRateMinutes;
    for (const segment of result.segments) priorWorkedMinutesByLocalDate[segment.localDate] = (priorWorkedMinutesByLocalDate[segment.localDate] ?? 0) + segment.minutes;
  }
  return { earnedMinor, futureMinor, forecastMinor: earnedMinor + futureMinor, incompleteShiftCount, regularMinutes, specialRateMinutes, resultsByShiftId };
}
