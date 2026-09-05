import type { CalendarEvidenceInterval, PayRule, SalaryProfile, WeeklyRestSchedule } from '@/domain/entities';

export type SalarySetupStatus = 'configured' | 'needs_attention' | 'not_configured';

export interface SalarySettingsOverview {
  holidayIntervalCount: number;
  holidayStatus: SalarySetupStatus;
  overtimeStatus: SalarySetupStatus;
  weeklyRestRateBasisPoints?: number;
  weeklyRestStatus: SalarySetupStatus;
}

export function buildSalarySettingsOverview(input: {
  intervals: readonly CalendarEvidenceInterval[];
  profile: SalaryProfile;
  rules: readonly PayRule[];
  weeklyRest?: WeeklyRestSchedule | null;
}): SalarySettingsOverview {
  const enabledRules = input.rules.filter((rule) => rule.isEnabled);
  const weeklyRestRule = enabledRules.find((rule) => rule.conditions.some((condition) => (
    condition.type === 'specialInterval' && condition.intervalTypes.includes('weekly_rest')
  )) && rule.effect.type === 'multiplier');
  const holidayIntervalCount = input.intervals.filter((interval) => !interval.isArchived && interval.type === 'holiday').length;
  const hasHolidayRule = enabledRules.some((rule) => rule.conditions.some((condition) => (
    condition.type === 'holiday'
    || (condition.type === 'specialInterval' && condition.intervalTypes.includes('holiday'))
    || (condition.type === 'specialIntervalId' && input.intervals.some((interval) => interval.id === condition.intervalId && interval.type === 'holiday'))
  )));
  const hasOvertimeRule = enabledRules.some((rule) => (
    rule.premiumFamily === 'overtime'
    || rule.conditions.some((condition) => condition.type === 'workedMinutes')
  ));

  return {
    holidayIntervalCount,
    holidayStatus: holidayIntervalCount > 0 && hasHolidayRule ? 'configured' : holidayIntervalCount > 0 || hasHolidayRule ? 'needs_attention' : 'not_configured',
    overtimeStatus: input.profile.weeklyOvertimeEnabled || hasOvertimeRule ? 'configured' : 'not_configured',
    weeklyRestRateBasisPoints: weeklyRestRule?.effect.type === 'multiplier' ? weeklyRestRule.effect.basisPoints : undefined,
    weeklyRestStatus: input.weeklyRest?.enabled && weeklyRestRule ? 'configured' : input.weeklyRest?.enabled || weeklyRestRule ? 'needs_attention' : 'not_configured',
  };
}

export function localDateInTimeZone(timezone: string, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit', month: '2-digit', timeZone: timezone, year: 'numeric',
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
