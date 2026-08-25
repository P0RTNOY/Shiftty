import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';

interface AppliedMigration {
  version: number;
  name: string;
}

async function readValidatedMigrationVersion(database: SQLiteDatabase): Promise<number> {
  const applied = await database.getAllAsync<AppliedMigration>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;',
  );

  for (let index = 0; index < applied.length; index += 1) {
    const recorded = applied[index];
    const expected = DATABASE_MIGRATIONS[index];
    if (!recorded || !expected || recorded.version !== expected.version || recorded.name !== expected.name) {
      throw new Error('Database migration history is incomplete or incompatible.');
    }
  }

  return applied.at(-1)?.version ?? 0;
}

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // A migration record is committed in the same transaction as its schema.
  // Validate the full prefix rather than trusting MAX(version): a missing or
  // unknown record should stop startup instead of silently skipping schema.
  const currentVersion = await readValidatedMigrationVersion(database);

  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withTransactionAsync(async () => {
      await database.execAsync(migration.sql);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}
