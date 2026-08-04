import type { SQLiteDatabase } from 'expo-sqlite';

import {
  recurrenceExceptionSchema,
  recurrenceSeriesSchema,
  shiftSchema,
  type RecurrenceException,
  type RecurrenceSeries,
  type Shift,
} from '@/domain/entities';
import type { RecurrenceMutation, RecurrenceRepository } from '@/domain/repositories';
import { SHIFT_COLUMNS, SqliteShiftRepository, toShiftParameters } from '@/data/repositories/sqlite-shift-repository';

interface SeriesRow { id: string; rule_json: string; template_json: string; disabled_from: string | null; created_at: string; updated_at: string }
interface ExceptionRow { id: string; series_id: string; local_date: string; type: 'deleted' | 'modified'; shift_id: string | null; created_at: string }

export class SqliteRecurrenceRepository implements RecurrenceRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async listAll(): Promise<RecurrenceSeries[]> {
    const rows = await this.database.getAllAsync<SeriesRow>('SELECT * FROM recurrence_series;');
    return rows.map(mapSeries);
  }

  async getSeries(id: string): Promise<RecurrenceSeries | null> {
    const row = await this.database.getFirstAsync<SeriesRow>('SELECT * FROM recurrence_series WHERE id = ?;', id);
    return row ? mapSeries(row) : null;
  }

  async saveSeries(input: RecurrenceSeries): Promise<void> {
    const series = recurrenceSeriesSchema.parse(input);
    await this.database.runAsync(
      `INSERT INTO recurrence_series (id, rule_json, template_json, disabled_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET rule_json=excluded.rule_json, template_json=excluded.template_json, disabled_from=excluded.disabled_from, updated_at=excluded.updated_at;`,
      series.id, JSON.stringify(series.rule), JSON.stringify(series.template), series.disabledFrom ?? null, series.createdAt, series.updatedAt,
    );
  }

  async listExceptions(seriesId: string): Promise<RecurrenceException[]> {
    const rows = await this.database.getAllAsync<ExceptionRow>(
      'SELECT * FROM recurrence_exceptions WHERE series_id = ? ORDER BY local_date;', seriesId,
    );
    return rows.map((row) => recurrenceExceptionSchema.parse({
      id: row.id, seriesId: row.series_id, localDate: row.local_date, type: row.type,
      shiftId: row.shift_id ?? undefined, createdAt: row.created_at,
    }));
  }

  async saveException(input: RecurrenceException): Promise<void> {
    const exception = recurrenceExceptionSchema.parse(input);
    await this.database.runAsync(
      `INSERT INTO recurrence_exceptions (id, series_id, local_date, type, shift_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(series_id, local_date) DO UPDATE SET type=excluded.type, shift_id=excluded.shift_id;`,
      exception.id, exception.seriesId, exception.localDate, exception.type,
      exception.shiftId ?? null, exception.createdAt,
    );
  }

  async materializeOccurrences(seriesInput: RecurrenceSeries, occurrences: readonly Shift[]): Promise<void> {
    const series = recurrenceSeriesSchema.parse(seriesInput);
    await this.database.withTransactionAsync(async () => {
      await this.saveSeries(series);
      for (const input of occurrences) {
        const shift = shiftSchema.parse(input);
        await this.database.runAsync(
          `INSERT OR IGNORE INTO shifts (${SHIFT_COLUMNS}) VALUES (${Array.from({ length: 28 }, () => '?').join(', ')});`,
          toShiftParameters(shift),
        );
      }
    });
  }

  async deleteSeries(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM recurrence_series WHERE id = ?;', id);
  }

  async applyMutation(mutation: RecurrenceMutation): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const series of mutation.seriesToSave ?? []) await this.saveSeries(series);
      const shifts = new SqliteShiftRepository(this.database);
      for (const shift of mutation.shiftsToSave ?? []) await shifts.save(shift);
      for (const exception of mutation.exceptionsToSave ?? []) await this.saveException(exception);
      for (const id of mutation.shiftIdsToDelete ?? []) await this.database.runAsync('DELETE FROM shifts WHERE id = ?;', id);
      for (const id of mutation.seriesIdsToDelete ?? []) await this.deleteSeries(id);
    });
  }
}

function mapSeries(row: SeriesRow): RecurrenceSeries {
  return recurrenceSeriesSchema.parse({
    id: row.id, rule: JSON.parse(row.rule_json), template: JSON.parse(row.template_json), disabledFrom: row.disabled_from ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
}
