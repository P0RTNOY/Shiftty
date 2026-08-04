import { z } from 'zod';

export const predictionFeedbackTypeSchema = z.enum([
  'accepted_all',
  'accepted_partial',
  'rejected',
  'edited_after_acceptance',
]);
export type PredictionFeedbackType = z.infer<typeof predictionFeedbackTypeSchema>;

export const predictionFeedbackSchema = z.object({
  id: z.string().min(1),
  feedbackType: predictionFeedbackTypeSchema,
  engineVersion: z.string().min(1),
  candidateSource: z.enum(['nearby_scheduled_shift', 'template', 'historical_pattern']),
  candidateSourceId: z.string().min(1),
  score: z.number().min(0).max(100),
  /** Fields the user accepted */
  acceptedFields: z.array(z.string()).default([]),
  /** Fields the user rejected */
  rejectedFields: z.array(z.string()).default([]),
  createdAt: z.iso.datetime({ offset: true }),
});
export type PredictionFeedback = z.infer<typeof predictionFeedbackSchema>;
