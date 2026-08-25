import type * as SQLite from 'expo-sqlite';

import { initializeDatabase } from '@/data/database/database';
import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { createRealSqliteDb } from '@/test-utils/real-sqlite';

jest.setTimeout(60_000);

const latestVersion = DATABASE_MIGRATIONS.at(-1)!.version;

async function createDatabaseAtVersion(version: number): Promise<SQLite.SQLiteDatabase> {
  const database = createRealSqliteDb();
  await database.execAsync(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version > version) break;
    await database.execAsync(migration.sql);
    await database.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
      migration.version,
      migration.name,
      '2026-08-25T00:00:00.000Z',
    );
  }
  return database;
}

describe('database migration recovery', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, latestVersion])(
    'upgrades a version %i database to the current schema with clean integrity',
    async (startingVersion) => {
      const database = startingVersion === 0
        ? createRealSqliteDb()
        : await createDatabaseAtVersion(startingVersion);
      try {
        await initializeDatabase(database);

        await expect(database.getFirstAsync('SELECT MAX(version) AS version FROM schema_migrations'))
          .resolves.toEqual({ version: latestVersion });
        await expect(database.getFirstAsync('PRAGMA integrity_check'))
          .resolves.toEqual({ integrity_check: 'ok' });
        await expect(database.getAllAsync('PRAGMA foreign_key_check'))
          .resolves.toEqual([]);
      } finally {
        await database.closeAsync();
      }
    },
  );

  it('rolls back an interrupted migration and completes it on retry', async () => {
    const database = await createDatabaseAtVersion(8);
    const originalRun = database.runAsync.bind(database);
    let shouldInterrupt = true;
    const runSpy = jest.spyOn(database, 'runAsync').mockImplementation(
      async (sql: string, ...args: SQLite.SQLiteBindValue[]) => {
        if (shouldInterrupt && sql.startsWith('INSERT INTO schema_migrations')) {
          shouldInterrupt = false;
          throw new Error('simulated interruption');
        }
        return originalRun(sql, ...args);
      },
    );

    try {
      await expect(initializeDatabase(database)).rejects.toThrow('simulated interruption');
      await expect(database.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_evidence_intervals'",
      )).resolves.toBeNull();
      await expect(database.getFirstAsync('SELECT MAX(version) AS version FROM schema_migrations'))
        .resolves.toEqual({ version: 8 });

      runSpy.mockRestore();
      await initializeDatabase(database);
      await expect(database.getFirstAsync('SELECT MAX(version) AS version FROM schema_migrations'))
        .resolves.toEqual({ version: latestVersion });
      await expect(database.getAllAsync('PRAGMA foreign_key_check')).resolves.toEqual([]);
    } finally {
      runSpy.mockRestore();
      await database.closeAsync();
    }
  });

  it('rejects incomplete migration history instead of skipping a missing schema step', async () => {
    const database = await createDatabaseAtVersion(3);
    try {
      await database.runAsync('DELETE FROM schema_migrations WHERE version = 2;');

      await expect(initializeDatabase(database)).rejects.toThrow(
        'Database migration history is incomplete or incompatible.',
      );
      await expect(database.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='salary_calculation_snapshots'",
      )).resolves.toBeNull();
    } finally {
      await database.closeAsync();
    }
  });

  it('rejects a database created by a newer incompatible app version', async () => {
    const database = await createDatabaseAtVersion(latestVersion);
    try {
      await database.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        latestVersion + 1,
        'future_schema',
        '2026-08-25T00:00:00.000Z',
      );

      await expect(initializeDatabase(database)).rejects.toThrow(
        'Database migration history is incomplete or incompatible.',
      );
    } finally {
      await database.closeAsync();
    }
  });
});
