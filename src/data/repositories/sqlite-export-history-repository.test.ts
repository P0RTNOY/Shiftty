import { SqliteExportHistoryRepository } from './sqlite-export-history-repository';
import * as SQLite from 'expo-sqlite';
import { ExportHistory } from '@/domain/entities/export-history';

import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('SqliteExportHistoryRepository', () => {
  let db: SQLite.SQLiteDatabase;
  let repo: SqliteExportHistoryRepository;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS export_history (
        id TEXT PRIMARY KEY,
        format TEXT NOT NULL,
        preset_id TEXT,
        reporting_period TEXT,
        workplace_filter TEXT,
        generated_at TEXT NOT NULL,
        sanitized_filename TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    repo = new SqliteExportHistoryRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('can save and get history', async () => {
    const record: ExportHistory = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      format: 'pdf',
      status: 'success',
      generatedAt: '2026-08-01T00:00:00Z',
      sanitizedFilename: 'shifts.pdf',
      createdAt: '2026-08-01T00:00:00Z'
    };
    await repo.create(record);
    
    const retrieved = await repo.listRecent(10);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0]).toEqual(record);
  });
});
