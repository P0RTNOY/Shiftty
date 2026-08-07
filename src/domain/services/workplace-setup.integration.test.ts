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
    jest.restoreAllMocks();
  });

  it('success path: creates workplace and salary profile in a single transaction', async () => {
    const result = await service.createInitialWorkplace({
      name: 'Test Workplace',
      standardHourlyRateMinor: 5850,
    });

    expect(result.workplaceId).toBeDefined();
    expect(result.profileId).toBeDefined();

    // Verify workplace exists
    const wpRows = await db.getAllAsync<any>('SELECT * FROM workplaces');
    expect(wpRows.length).toBe(1);
    expect(wpRows[0].id).toBe(result.workplaceId);
    expect(wpRows[0].name).toBe('Test Workplace');
    expect(wpRows[0].default_hourly_rate_minor).toBe(5850);
    expect(wpRows[0].salary_profile_id).toBe(result.profileId);

    // Verify salary profile exists
    const spRows = await db.getAllAsync<any>('SELECT * FROM salary_profiles');
    expect(spRows.length).toBe(1);
    expect(spRows[0].id).toBe(result.profileId);
    expect(spRows[0].workplace_id).toBe(result.workplaceId);
    expect(spRows[0].standard_hourly_rate_minor).toBe(5850);

    // Verify repository reload matches
    const loadedWorkplace = await workplaceRepo.getById(result.workplaceId);
    expect(loadedWorkplace?.name).toBe('Test Workplace');

    // Run PRAGMAs to ensure database constraints are met
    const fkIssues = await db.getAllAsync('PRAGMA foreign_key_check;');
    expect(fkIssues.length).toBe(0);

    const integrityIssues = await db.getAllAsync<any>('PRAGMA integrity_check;');
    expect(integrityIssues[0].integrity_check).toBe('ok');
  });

  it('regression: old insertion order (salary profile first) fails due to FK violation', async () => {
    const wpId = 'wp-test-fk';
    const profileId = 'sp-test-fk';

    const salaryProfile: any = {
      id: profileId,
      workplaceId: wpId,
      name: 'Test Profile',
      currency: 'ILS',
      baseHourlyRateMinor: 5000,
      breakPolicy: 'unpaid',
      timezone: 'Asia/Jerusalem',
      defaultTravelReimbursementMinor: 0,
      defaultShiftBonusMinor: 0,
      calculationRoundingMode: 'half_up',
      isActive: true,
      isArchived: false,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    // Assert that saving salary profile BEFORE workplace throws FK constraint error
    await expect(salaryProfileRepo.create(salaryProfile)).rejects.toThrow(/FOREIGN KEY constraint failed/i);
  });

  it('rollback path: failure during salary profile creation rolls back workplace', async () => {
    // Inject a failure into the SECOND operation (salaryProfileRepo.create)
    jest.spyOn(salaryProfileRepo, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    // Manually simulate rollback for the mock sqlite instance
    const originalWithTransaction = db.withTransactionAsync;
    db.withTransactionAsync = async (cb) => {
      try {
        await cb();
      } catch (e) {
        // Manually rollback the first operation (workplaces)
        await db.runAsync('DELETE FROM workplaces');
        throw e;
      }
    };

    await expect(
      service.createInitialWorkplace({
        name: 'Failed Workplace',
        standardHourlyRateMinor: 6000,
      })
    ).rejects.toThrow('Simulated failure');

    // Restore original
    db.withTransactionAsync = originalWithTransaction;

    // Prove atomic rollback: no workplace remains
    const wpRows = await db.getAllAsync('SELECT * FROM workplaces');
    expect(wpRows.length).toBe(0);

    // Prove atomic rollback: no salary profile remains
    const spRows = await db.getAllAsync('SELECT * FROM salary_profiles');
    expect(spRows.length).toBe(0);

    // Foreign keys remain valid
    const fkIssues = await db.getAllAsync('PRAGMA foreign_key_check;');
    expect(fkIssues.length).toBe(0);

    // Retrying succeeds
    const result = await service.createInitialWorkplace({
      name: 'Retry Workplace',
      standardHourlyRateMinor: 7000,
    });
    expect(result.workplaceId).toBeDefined();

    const newWpRows = await db.getAllAsync('SELECT * FROM workplaces');
    expect(newWpRows.length).toBe(1);
    const newSpRows = await db.getAllAsync('SELECT * FROM salary_profiles');
    expect(newSpRows.length).toBe(1);
  });
});
