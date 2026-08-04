import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteActiveShiftRepository, SqlitePayRuleRepository, SqliteRecurrenceRepository, SqliteSalaryCalculationRepository, SqliteSalaryProfileRepository, SqliteShiftRepository, SqliteShiftTemplateRepository, SqliteWorkplaceRepository } from '@/data/repositories';

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
  }), [database]);
}
