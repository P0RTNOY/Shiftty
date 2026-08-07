import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from '@/data/database/database';
import { WorkplaceSetupService } from './workplace-setup-service';
import { SqliteWorkplaceRepository } from '@/data/repositories/sqlite-workplace-repository';
import { SqliteSalaryProfileRepository } from '@/data/repositories/sqlite-salary-repositories';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('WorkplaceSetupService Integration', () => {
  let db: SQLite.SQLiteDatabase;
  let workplaceRepo: SqliteWorkplaceRepository;
  let salaryProfileRepo: SqliteSalaryProfileRepository;
  let service: WorkplaceSetupService;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await initializeDatabase(db);
    workplaceRepo = new SqliteWorkplaceRepository(db);
    salaryProfileRepo = new SqliteSalaryProfileRepository(db);
    service = new WorkplaceSetupService(db, workplaceRepo, salaryProfileRepo);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('creates workplace and salary profile with correct schema relationships', async () => {
    const result = await service.createInitialWorkplace({
      name: 'Test Coffee Shop',
      standardHourlyRateMinor: 5850,
    });

    expect(result.workplaceId).toBeDefined();
    expect(result.profileId).toBeDefined();

    // Verify Workplace Exists
    const workplace = await workplaceRepo.getById(result.workplaceId);
    expect(workplace).not.toBeNull();
    expect(workplace?.name).toBe('Test Coffee Shop');
    expect(workplace?.defaultHourlyRateMinor).toBe(5850);
    expect(workplace?.salaryProfileId).toBe(result.profileId);

    // Verify Salary Profile Exists
    const profile = await salaryProfileRepo.getById(result.profileId);
    expect(profile).not.toBeNull();
    expect(profile?.workplaceId).toBe(result.workplaceId);
    expect(profile?.baseHourlyRateMinor).toBe(5850); // The domain entity uses baseHourlyRateMinor which maps to standard_hourly_rate_minor
    expect(profile?.name).toBe('פרופיל בסיסי - Test Coffee Shop');

    // Verify raw SQLite directly to ensure standard_hourly_rate_minor is persisted properly
    const rawProfile = await db.getFirstAsync<any>('SELECT standard_hourly_rate_minor FROM salary_profiles WHERE id = ?', [result.profileId]);
    expect(rawProfile?.standard_hourly_rate_minor).toBe(5850);

    // Run PRAGMA checks to verify database integrity and foreign keys
    const fkCheck = await db.getAllAsync('PRAGMA foreign_key_check;');
    expect(fkCheck).toEqual([]);

    const integrityCheck = await db.getAllAsync<any>('PRAGMA integrity_check;');
    // sqlite integrity_check returns [{ integrity_check: 'ok' }]
    expect(integrityCheck[0]?.integrity_check).toBe('ok');
  });
});
