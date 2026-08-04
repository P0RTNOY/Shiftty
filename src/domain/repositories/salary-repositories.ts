import type { PayRule, SalaryCalculationSnapshot, SalaryProfile } from '@/domain/entities';

export interface SalaryProfileRepository {
  create(profile: SalaryProfile): Promise<void>;
  update(profile: SalaryProfile): Promise<void>;
  createVersion(previous: SalaryProfile, next: SalaryProfile): Promise<void>;
  getById(id: string): Promise<SalaryProfile | null>;
  listByWorkplace(workplaceId: string): Promise<SalaryProfile[]>;
  resolveForDate(workplaceId: string, localDate: string): Promise<SalaryProfile | null>;
}

export interface PayRuleRepository {
  save(rule: PayRule): Promise<void>;
  getById(id: string): Promise<PayRule | null>;
  listForProfile(profileId: string): Promise<PayRule[]>;
  delete(id: string): Promise<void>;
}

export interface SalaryCalculationRepository {
  saveSnapshot(snapshot: SalaryCalculationSnapshot): Promise<void>;
  getLatestForShift(shiftId: string): Promise<SalaryCalculationSnapshot | null>;
  listHistory(shiftId: string): Promise<SalaryCalculationSnapshot[]>;
  listCurrentForShifts(shiftIds: readonly string[]): Promise<SalaryCalculationSnapshot[]>;
  markStale(shiftId: string): Promise<void>;
  markIncomplete(shiftId: string): Promise<void>;
}
