import { SQLiteDatabase } from 'expo-sqlite';
import { ExportHistory, ExportHistorySchema } from '@/domain/entities/export-history';

export class SqliteExportHistoryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(history: ExportHistory): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO export_history (
        id, format, preset_id, reporting_period, workplace_filter,
        generated_at, sanitized_filename, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        history.id,
        history.format,
        history.presetId || null,
        history.reportingPeriod || null,
        history.workplaceFilter || null,
        history.generatedAt,
        history.sanitizedFilename || null,
        history.status,
        history.createdAt,
      ]
    );
  }

  async listRecent(limit: number = 50): Promise<ExportHistory[]> {
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM export_history ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map(this.mapRow);
  }

  async clearAll(): Promise<void> {
    await this.db.runAsync(`DELETE FROM export_history`);
  }

  private mapRow(row: any): ExportHistory {
    return ExportHistorySchema.parse({
      id: row.id,
      format: row.format,
      presetId: row.preset_id || undefined,
      reportingPeriod: row.reporting_period || undefined,
      workplaceFilter: row.workplace_filter || undefined,
      generatedAt: row.generated_at,
      sanitizedFilename: row.sanitized_filename || undefined,
      status: row.status,
      createdAt: row.created_at,
    });
  }
}
