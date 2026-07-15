import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';

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

  const current = await database.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations;',
  );
  const currentVersion = current?.version ?? 0;

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
