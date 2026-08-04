/**
 * Prediction Orchestrator
 *
 * Loads data from repositories and calls the pure prediction engine.
 * This is the only layer that accesses SQLite for prediction purposes.
 *
 * History window: last 90 days of completed shifts (bounded query)
 * Feedback window: last 50 feedback events
 * Upcoming shifts: next 3 hours (for nearby-shift matching)
 */

import { addHours, subDays, getDay } from 'date-fns';

import type { ShiftRepository } from '@/domain/repositories';
import type { ShiftTemplateRepository } from '@/domain/repositories/shift-template-repository';
import type { PredictionFeedbackRepository } from '@/domain/repositories/prediction-feedback-repository';
import { detectHistoricalPatterns } from '@/domain/services/historical-pattern-service';
import { runPredictionEngine, type PredictionEngineInput } from '@/domain/services/shift-prediction-engine';
import type { ShiftPredictionResult } from '@/domain/entities/prediction';

export interface OrchestratePredictionInput {
  now: Date;
  timezone: string;
  selectedWorkplaceId?: string;
  selectedRoleId?: string;
}

export async function orchestratePrediction(
  input: OrchestratePredictionInput,
  deps: {
    shifts: ShiftRepository;
    templates: ShiftTemplateRepository;
    feedback: PredictionFeedbackRepository;
  },
): Promise<ShiftPredictionResult> {
  const { now, timezone } = input;
  const nowIso = now.toISOString();

  // Load upcoming scheduled shifts (within ±3 hours)
  const windowStart = addHours(now, -3).toISOString();
  const windowEnd = addHours(now, 3).toISOString();
  const nearbyScheduledShifts = await deps.shifts.list({
    statuses: ['scheduled'],
    endsAfter: windowStart,
    startsBefore: windowEnd,
  });

  // Load recent completed shifts (last 90 days)
  const historyStart = subDays(now, 90).toISOString();
  const recentCompletedShifts = await deps.shifts.list({
    statuses: ['completed'],
    endsAfter: historyStart,
  });

  // Load active templates
  const templates = await deps.templates.listActive();

  // Load recent feedback
  const recentFeedback = await deps.feedback.listRecent(50);

  // Detect historical patterns
  const historicalPatterns = detectHistoricalPatterns(recentCompletedShifts, timezone);

  const engineInput: PredictionEngineInput = {
    now: nowIso,
    timezone,
    selectedWorkplaceId: input.selectedWorkplaceId,
    selectedRoleId: input.selectedRoleId,
    nearbyScheduledShifts,
    templates,
    recentCompletedShifts,
    historicalPatterns,
    recentFeedback,
    weekday: getDay(now),
  };

  return runPredictionEngine(engineInput);
}
