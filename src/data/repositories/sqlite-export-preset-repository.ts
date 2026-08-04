import { SQLiteDatabase } from 'expo-sqlite';
import { ExportPreset, ExportPresetSchema } from '@/domain/entities/export-preset';

export class SqliteExportPresetRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(preset: ExportPreset): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO export_presets (id, name, format, config_json, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        preset.id,
        preset.name,
        preset.format,
        JSON.stringify(preset.config),
        preset.isArchived ? 1 : 0,
        preset.createdAt,
        preset.updatedAt,
      ]
    );
  }

  async update(id: string, updates: Partial<Omit<ExportPreset, 'id' | 'createdAt'>>): Promise<ExportPreset> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Export preset not found: \${id}`);
    }

    const updated: ExportPreset = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    ExportPresetSchema.parse(updated);

    await this.db.runAsync(
      `UPDATE export_presets 
       SET name = ?, format = ?, config_json = ?, is_archived = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.format,
        JSON.stringify(updated.config),
        updated.isArchived ? 1 : 0,
        updated.updatedAt,
        id,
      ]
    );

    return updated;
  }

  async getById(id: string): Promise<ExportPreset | null> {
    const row = await this.db.getFirstAsync<any>(
      `SELECT * FROM export_presets WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return this.mapRow(row);
  }

  async listActive(): Promise<ExportPreset[]> {
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM export_presets WHERE is_archived = 0 ORDER BY name COLLATE NOCASE`
    );
    return rows.map(this.mapRow);
  }
  
  async listAll(): Promise<ExportPreset[]> {
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM export_presets ORDER BY name COLLATE NOCASE`
    );
    return rows.map(this.mapRow);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM export_presets WHERE id = ?`, [id]);
  }

  private mapRow(row: any): ExportPreset {
    return ExportPresetSchema.parse({
      id: row.id,
      name: row.name,
      format: row.format,
      config: JSON.parse(row.config_json),
      isArchived: row.is_archived === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
