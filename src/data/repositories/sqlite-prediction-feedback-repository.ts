import type { SQLiteDatabase } from 'expo-sqlite';

import { predictionFeedbackSchema, type PredictionFeedback } from '@/domain/entities';
import type { PredictionFeedbackRepository, RecordPredictionFeedbackInput } from '@/domain/repositories';
import { createId } from '@/shared/utils/id';

export class SqlitePredictionFeedbackRepository implements PredictionFeedbackRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async record(input: RecordPredictionFeedbackInput): Promise<void> {
    const id = createId('feedback');
    const now = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO prediction_feedback
        (id, feedback_type, engine_version, candidate_source, candidate_source_id, score,
         accepted_fields_json, rejected_fields_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        input.feedbackType,
        input.engineVersion,
        input.candidateSource,
        input.candidateSourceId,
        input.score,
        JSON.stringify(input.acceptedFields),
        JSON.stringify(input.rejectedFields),
        now,
      ],
    );
  }

  async listRecent(limit = 50): Promise<PredictionFeedback[]> {
    const rows = await this.database.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM prediction_feedback ORDER BY created_at DESC LIMIT ?;',
      [limit],
    );
    return rows.map((row) =>
      predictionFeedbackSchema.parse({
        id: row.id,
        feedbackType: row.feedback_type,
        engineVersion: row.engine_version,
        candidateSource: row.candidate_source,
        candidateSourceId: row.candidate_source_id,
        score: row.score,
        acceptedFields: JSON.parse(row.accepted_fields_json as string) as string[],
        rejectedFields: JSON.parse(row.rejected_fields_json as string) as string[],
        createdAt: row.created_at,
      }),
    );
  }

  async clearAll(): Promise<void> {
    await this.database.runAsync('DELETE FROM prediction_feedback;');
  }
}
