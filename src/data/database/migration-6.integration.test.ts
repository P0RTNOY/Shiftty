import * as SQLite from 'expo-sqlite';
import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

async function runUpToVersion(db: SQLite.SQLiteDatabase, version: number) {
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= version) {
      await db.execAsync(migration.sql);
    }
  }
}

describe('Migration 6 Integration', () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(async () => {
    db = createRealSqliteDb();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('empty database does not set onboarding_completed', async () => {
    await runUpToVersion(db, 6);
    
    const setting = await db.getFirstAsync<{value_json: string}>('SELECT value_json FROM app_settings WHERE key = "onboarding_completed"');
    expect(setting).toBeNull();
  });

  it('existing database with workplace sets onboarding_completed to true', async () => {
    // Run up to migration 5
    await runUpToVersion(db, 5);
    
    // Insert a workplace
    await db.runAsync("INSERT INTO workplaces (id, name, default_hourly_rate_minor, default_break_minutes, created_at, updated_at) VALUES ('wp1', 'My WP', 0, 0, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')");

    // Run migration 6
    const migration6 = DATABASE_MIGRATIONS.find(m => m.version === 6)!;
    await db.execAsync(migration6.sql);

    const setting = await db.getFirstAsync<{value_json: string}>('SELECT value_json FROM app_settings WHERE key = "onboarding_completed"');
    expect(setting).not.toBeNull();
    expect(setting?.value_json).toBe('true');
  });
});
