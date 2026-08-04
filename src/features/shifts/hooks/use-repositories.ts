import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  SqliteActiveShiftRepository,
  SqliteNotificationSettingsRepository,
  SqlitePayRuleRepository,
  SqlitePredictionFeedbackRepository,
  SqliteRecurrenceRepository,
  SqliteSalaryCalculationRepository,
  SqliteSalaryProfileRepository,
  SqliteScheduledNotificationRepository,
  SqliteShiftRepository,
  SqliteShiftTemplateRepository,
  SqliteWorkplaceRepository,
} from '@/data/repositories';

export function useRepositories() {
  const database = useSQLiteContext();
  return useMemo(() => ({
    shifts: new SqliteShiftRepository(database),
    activeShifts: new SqliteActiveShiftRepository(database),
    shiftTemplates: new SqliteShiftTemplateRepository(database),
    recurrence: new SqliteRecurrenceRepository(database),
    workplaces: new SqliteWorkplaceRepository(database),
    salaryProfiles: new SqliteSalaryProfileRepository(database),
    payRules: new SqlitePayRuleRepository(database),
    salaryCalculations: new SqliteSalaryCalculationRepository(database),
    notificationSettings: new SqliteNotificationSettingsRepository(database),
    predictionFeedback: new SqlitePredictionFeedbackRepository(database),
    scheduledNotifications: new SqliteScheduledNotificationRepository(database),
  }), [database]);
}
