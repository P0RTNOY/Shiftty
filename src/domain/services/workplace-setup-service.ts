import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteWorkplaceRepository } from '@/data/repositories/sqlite-workplace-repository';
import { SqliteSalaryProfileRepository } from '@/data/repositories/sqlite-salary-repositories';
import type { Workplace, SalaryProfile } from '@/domain/entities';

export interface WorkplaceSetupOptions {
  name: string;
  standardHourlyRateMinor: number;
  currency?: string;
  timezone?: string;
}

export class WorkplaceSetupService {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly workplaceRepo: SqliteWorkplaceRepository,
    private readonly salaryProfileRepo: SqliteSalaryProfileRepository
  ) {}

  async createInitialWorkplace(options: WorkplaceSetupOptions): Promise<{ workplaceId: string; profileId: string }> {
    const wpId = Crypto.randomUUID();
    const profileId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const salaryProfile: SalaryProfile = {
      id: profileId,
      workplaceId: wpId,
      name: `פרופיל בסיסי - ${options.name}`,
      currency: options.currency || 'ILS',
      baseHourlyRateMinor: options.standardHourlyRateMinor,
      breakPolicy: 'unpaid',
      timezone: options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
      defaultTravelReimbursementMinor: 0,
      defaultShiftBonusMinor: 0,
      calculationRoundingMode: 'half_up',
      isActive: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const workplace: Workplace = {
      id: wpId,
      name: options.name,
      defaultHourlyRateMinor: options.standardHourlyRateMinor,
      defaultBreakMinutes: 0,
      salaryProfileId: undefined, // Omit first to avoid FK violation
      defaultTravelReimbursementMinor: 0,
      defaultShiftBonusMinor: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.withTransactionAsync(async () => {
      // 1. Insert Workplace (without salary profile reference)
      await this.workplaceRepo.save(workplace);

      // 2. Insert Salary Profile (referencing the new workplace)
      await this.salaryProfileRepo.create(salaryProfile);

      // 3. Update Workplace with the salary profile ID
      workplace.salaryProfileId = profileId;
      await this.workplaceRepo.save(workplace);
    });

    return { workplaceId: wpId, profileId };
  }
}
