import type { PredictionFeedback } from '@/domain/entities';

export interface RecordPredictionFeedbackInput {
  feedbackType: PredictionFeedback['feedbackType'];
  engineVersion: string;
  candidateSource: PredictionFeedback['candidateSource'];
  candidateSourceId: string;
  score: number;
  acceptedFields: string[];
  rejectedFields: string[];
}

export interface PredictionFeedbackRepository {
  record(input: RecordPredictionFeedbackInput): Promise<void>;
  listRecent(limit?: number): Promise<PredictionFeedback[]>;
  clearAll(): Promise<void>;
}
