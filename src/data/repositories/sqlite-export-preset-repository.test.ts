import { SqliteExportPresetRepository } from './sqlite-export-preset-repository';
import * as SQLite from 'expo-sqlite';
import { ExportPreset } from '@/domain/entities/export-preset';

import { createRealSqliteDb } from '@/test-utils/real-sqlite';

describe('SqliteExportPresetRepository', () => {
  let db: SQLite.SQLiteDatabase;
  let repo: SqliteExportPresetRepository;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS export_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        config_json TEXT NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    repo = new SqliteExportPresetRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('can create and get a preset', async () => {
    const preset: ExportPreset = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      name: 'Monthly PDF',
      format: 'pdf',
      config: { periodType: 'month' },
      isArchived: false,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z'
    };
    await repo.create(preset);
    
    const retrieved = await repo.getById('123e4567-e89b-42d3-a456-426614174000');
    expect(retrieved).toEqual(preset);
  });

  it('can get all unarchived presets', async () => {
    await repo.create({
      id: '123e4567-e89b-42d3-a456-426614174000', name: 'A', format: 'pdf', config: { periodType: 'month' }, isArchived: false, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z'
    });
    await repo.create({
      id: '123e4567-e89b-42d3-a456-426614174001', name: 'B', format: 'csv', config: { periodType: 'month' }, isArchived: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z'
    });

    const all = await repo.listActive();
    expect(all.length).toBe(1);
    expect(all[0]!.id).toBe('123e4567-e89b-42d3-a456-426614174000');
  });
});
