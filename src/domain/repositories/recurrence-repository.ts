import type { RecurrenceException, RecurrenceSeries, Shift } from '@/domain/entities';

export interface RecurrenceMutation {
  seriesToSave?: readonly RecurrenceSeries[];
  shiftsToSave?: readonly Shift[];
  exceptionsToSave?: readonly RecurrenceException[];
  shiftIdsToDelete?: readonly string[];
  seriesIdsToDelete?: readonly string[];
}

export interface RecurrenceRepository {
  getSeries(id: string): Promise<RecurrenceSeries | null>;
  saveSeries(series: RecurrenceSeries): Promise<void>;
  listExceptions(seriesId: string): Promise<RecurrenceException[]>;
  saveException(exception: RecurrenceException): Promise<void>;
  materializeOccurrences(series: RecurrenceSeries, occurrences: readonly Shift[]): Promise<void>;
  deleteSeries(id: string): Promise<void>;
  applyMutation(mutation: RecurrenceMutation): Promise<void>;
}
