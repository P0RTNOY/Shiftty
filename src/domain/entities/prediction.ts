import { z } from 'zod';

export const predictionSourceSchema = z.enum(['nearby_scheduled_shift', 'template', 'historical_pattern']);
export type PredictionSource = z.infer<typeof predictionSourceSchema>;

export const predictionConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type PredictionConfidence = z.infer<typeof predictionConfidenceSchema>;

export const predictionReasonSchema = z.object({
  code: z.string().min(1),
  /** i18n key for human-readable label */
  messageKey: z.string().min(1),
  weight: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PredictionReason = z.infer<typeof predictionReasonSchema>;

export const shiftPredictionCandidateSchema = z.object({
  source: predictionSourceSchema,
  sourceId: z.string().min(1),

  suggestedScheduledStart: z.string().datetime({ offset: true }).optional(),
  suggestedScheduledEnd: z.string().datetime({ offset: true }).optional(),
  suggestedExpectedEnd: z.string().datetime({ offset: true }).optional(),

  suggestedWorkplaceId: z.string().min(1).optional(),
  suggestedRoleId: z.string().min(1).optional(),
  suggestedTemplateId: z.string().min(1).optional(),
  suggestedSalaryProfileId: z.string().min(1).optional(),

  suggestedBreakMinutes: z.number().int().min(0).optional(),
  suggestedBreakType: z.enum(['paid', 'unpaid']).optional(),

  /** Score 0–100 */
  score: z.number().min(0).max(100),
  confidence: predictionConfidenceSchema,
  reasons: z.array(predictionReasonSchema),
});
export type ShiftPredictionCandidate = z.infer<typeof shiftPredictionCandidateSchema>;

export const shiftPredictionInputSchema = z.object({
  now: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  selectedWorkplaceId: z.string().min(1).optional(),
  selectedRoleId: z.string().min(1).optional(),
  weekday: z.number().int().min(0).max(6),
});
export type ShiftPredictionInput = z.infer<typeof shiftPredictionInputSchema>;

export interface ShiftPredictionResult {
  recommended?: ShiftPredictionCandidate;
  candidates: ShiftPredictionCandidate[];
  generatedAt: string;
  /** Increment when scoring algorithm changes to invalidate cached results */
  engineVersion: string;
}

/**
 * Confidence thresholds (score >= threshold → confidence level):
 * High:   score >= 80
 * Medium: score >= 55
 * Low:    score >= 35
 * Below minimum: not shown unless user opens "other suggestions"
 */
export const CONFIDENCE_THRESHOLD_HIGH = 80;
export const CONFIDENCE_THRESHOLD_MEDIUM = 55;
export const CONFIDENCE_THRESHOLD_LOW = 35;
export const CONFIDENCE_THRESHOLD_MINIMUM = 20;

export function scoreToConfidence(score: number): PredictionConfidence {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return 'medium';
  return 'low';
}
