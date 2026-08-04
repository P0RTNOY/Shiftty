/**
 * Shift Prediction Engine — Pure, deterministic, no SQLite/React/Zustand.
 *
 * Scoring components (all capped, rounded to integers):
 *   Start-time proximity:         up to 40 points
 *   Weekday match:                up to 15 points
 *   Workplace match:              up to 15 points
 *   Role match:                   up to 10 points
 *   Recent usage frequency:       up to 10 points
 *   Recent acceptance feedback:   up to 10 points
 *
 * Source preference order (same score → lower priority wins as tiebreaker):
 *   1. nearby_scheduled_shift
 *   2. template
 *   3. historical_pattern
 *
 * Engine version: "1.0.0" — increment when scoring algorithm changes.
 */

import { differenceInMinutes, getDay, parseISO, format, addMinutes } from 'date-fns';

import type { Shift, ShiftTemplate } from '@/domain/entities';
import {
  type PredictionReason,
  type ShiftPredictionCandidate,
  type ShiftPredictionResult,
  scoreToConfidence,
  CONFIDENCE_THRESHOLD_MINIMUM,
} from '@/domain/entities/prediction';
import type { PredictionFeedback } from '@/domain/entities/prediction-feedback';
import { resolveLocalShiftRange } from '@/shared/utils/zoned-time';

export const PREDICTION_ENGINE_VERSION = '1.0.0';

/** Maximum time difference (minutes) for a nearby scheduled shift to be considered */
const NEARBY_SHIFT_MAX_DIFF_MINUTES = 180;
/** Maximum time difference (minutes) for a template start-time match */
const TEMPLATE_START_MAX_DIFF_MINUTES = 120;
/** Scoring: full proximity points if within this many minutes */
const PROXIMITY_FULL_MATCH_MINUTES = 10;

export interface HistoricalPattern {
  workplaceId: string;
  roleId?: string;
  weekday: number;
  medianStartTime: string; // HH:mm
  medianEndTime: string; // HH:mm
  medianBreakMinutes: number;
  observationCount: number;
  /** Pattern ID used as sourceId */
  patternId: string;
}

export interface PredictionEngineInput {
  now: string; // ISO timestamp
  timezone: string;
  selectedWorkplaceId?: string;
  selectedRoleId?: string;
  nearbyScheduledShifts: readonly Shift[];
  templates: readonly ShiftTemplate[];
  recentCompletedShifts: readonly Shift[];
  historicalPatterns?: readonly HistoricalPattern[];
  recentFeedback?: readonly PredictionFeedback[];
  weekday: number; // 0=Sun
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runPredictionEngine(input: PredictionEngineInput): ShiftPredictionResult {
  const now = parseISO(input.now);
  const candidates: ShiftPredictionCandidate[] = [];

  // Source 1: nearby scheduled shifts
  for (const shift of input.nearbyScheduledShifts) {
    const candidate = scoreNearbyShift(shift, now, input);
    if (candidate && candidate.score >= CONFIDENCE_THRESHOLD_MINIMUM) {
      candidates.push(candidate);
    }
  }

  // Source 2: templates
  for (const template of input.templates) {
    if (template.isArchived) continue;
    const candidate = scoreTemplate(template, now, input);
    if (candidate && candidate.score >= CONFIDENCE_THRESHOLD_MINIMUM) {
      candidates.push(candidate);
    }
  }

  // Source 3: historical patterns (from orchestrator)
  for (const pattern of input.historicalPatterns ?? []) {
    const candidate = scoreHistoricalPattern(pattern, now, input);
    if (candidate && candidate.score >= CONFIDENCE_THRESHOLD_MINIMUM) {
      candidates.push(candidate);
    }
  }

  // Sort: highest score first; tie-break by source priority then sourceId
  const sourcePriority = (source: ShiftPredictionCandidate['source']): number =>
    source === 'nearby_scheduled_shift' ? 0 : source === 'template' ? 1 : 2;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ap = sourcePriority(a.source);
    const bp = sourcePriority(b.source);
    if (ap !== bp) return ap - bp;
    return a.sourceId.localeCompare(b.sourceId);
  });

  const recommended = candidates[0];

  return {
    recommended: recommended ?? undefined,
    candidates,
    generatedAt: input.now,
    engineVersion: PREDICTION_ENGINE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Nearby scheduled shift scoring
// ---------------------------------------------------------------------------

function scoreNearbyShift(
  shift: Shift,
  now: Date,
  input: PredictionEngineInput,
): ShiftPredictionCandidate | null {
  if (!shift.scheduledStart || !shift.scheduledEnd) return null;
  if (!['scheduled'].includes(shift.status)) return null;

  const startDate = parseISO(shift.scheduledStart);
  const endDate = parseISO(shift.scheduledEnd);

  // Exclude if end is more than 3 hours in the past
  if (endDate.getTime() < now.getTime() - 3 * 60 * 60 * 1000) return null;

  const diffMinutes = Math.abs(differenceInMinutes(now, startDate));
  if (diffMinutes > NEARBY_SHIFT_MAX_DIFF_MINUTES) return null;

  const reasons: PredictionReason[] = [];
  let score = 0;

  // Proximity bonus (up to 40 pts)
  const proximityScore = diffMinutes <= PROXIMITY_FULL_MATCH_MINUTES
    ? 40
    : Math.max(0, Math.round(40 * (1 - (diffMinutes - PROXIMITY_FULL_MATCH_MINUTES) / (NEARBY_SHIFT_MAX_DIFF_MINUTES - PROXIMITY_FULL_MATCH_MINUTES))));
  score += proximityScore;
  reasons.push({
    code: 'nearby_start_diff',
    messageKey: 'prediction.reason.nearbyStartDiff',
    weight: proximityScore,
    metadata: { diffMinutes },
  });

  // Workplace match (15 pts)
  if (input.selectedWorkplaceId && input.selectedWorkplaceId === shift.workplaceId) {
    score += 15;
    reasons.push({ code: 'workplace_match', messageKey: 'prediction.reason.workplaceMatch', weight: 15 });
  }

  // Role match (10 pts)
  if (input.selectedRoleId && input.selectedRoleId === shift.roleId) {
    score += 10;
    reasons.push({ code: 'role_match', messageKey: 'prediction.reason.roleMatch', weight: 10 });
  }

  // Weekday match (15 pts)
  if (getDay(startDate) === input.weekday) {
    score += 15;
    reasons.push({ code: 'weekday_match', messageKey: 'prediction.reason.weekdayMatch', weight: 15 });
  }

  // Additional: scheduled shift is an explicit plan — add flat bonus
  score = Math.min(100, score + 10);
  reasons.push({ code: 'explicit_schedule', messageKey: 'prediction.reason.explicitSchedule', weight: 10 });

  const totalScore = Math.min(100, Math.round(score));

  return {
    source: 'nearby_scheduled_shift',
    sourceId: shift.id,
    suggestedScheduledStart: shift.scheduledStart,
    suggestedScheduledEnd: shift.scheduledEnd,
    suggestedExpectedEnd: shift.scheduledEnd,
    suggestedWorkplaceId: shift.workplaceId,
    suggestedRoleId: shift.roleId,
    suggestedTemplateId: shift.shiftTemplateId,
    suggestedSalaryProfileId: shift.salaryProfileId,
    suggestedBreakMinutes: shift.expectedBreakMinutes,
    score: totalScore,
    confidence: scoreToConfidence(totalScore),
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Template scoring
// ---------------------------------------------------------------------------

function scoreTemplate(
  template: ShiftTemplate,
  now: Date,
  input: PredictionEngineInput,
): ShiftPredictionCandidate | null {
  // Check weekday restriction
  if (template.validWeekdays && template.validWeekdays.length > 0) {
    if (!template.validWeekdays.includes(input.weekday)) {
      return null;
    }
  }

  // Calculate today's local date in timezone
  const localDate = formatLocalDate(now, input.timezone);
  const range = resolveLocalShiftRange(localDate, template.defaultStartTime, template.defaultEndTime, input.timezone);
  const templateStart = parseISO(range.start);
  const diffMinutes = Math.abs(differenceInMinutes(now, templateStart));

  if (diffMinutes > TEMPLATE_START_MAX_DIFF_MINUTES) return null;

  const reasons: PredictionReason[] = [];
  let score = 0;

  // Start-time proximity (up to 40 pts)
  const proximityScore = diffMinutes <= PROXIMITY_FULL_MATCH_MINUTES
    ? 40
    : Math.max(0, Math.round(40 * (1 - (diffMinutes - PROXIMITY_FULL_MATCH_MINUTES) / (TEMPLATE_START_MAX_DIFF_MINUTES - PROXIMITY_FULL_MATCH_MINUTES))));
  score += proximityScore;
  reasons.push({
    code: 'template_start_proximity',
    messageKey: 'prediction.reason.templateStartProximity',
    weight: proximityScore,
    metadata: { diffMinutes, templateStart: template.defaultStartTime },
  });

  // Weekday match (15 pts)
  const weekdayValid = !template.validWeekdays || template.validWeekdays.length === 0 || template.validWeekdays.includes(input.weekday);
  if (weekdayValid && template.validWeekdays && template.validWeekdays.includes(input.weekday)) {
    score += 15;
    reasons.push({ code: 'weekday_match', messageKey: 'prediction.reason.weekdayMatch', weight: 15 });
  } else if (!template.validWeekdays || template.validWeekdays.length === 0) {
    // No restriction, partial match
    score += 8;
    reasons.push({ code: 'weekday_no_restriction', messageKey: 'prediction.reason.weekdayNoRestriction', weight: 8 });
  }

  // Workplace match (15 pts)
  if (template.workplaceId && input.selectedWorkplaceId === template.workplaceId) {
    score += 15;
    reasons.push({ code: 'workplace_match', messageKey: 'prediction.reason.workplaceMatch', weight: 15 });
  }

  // Role match (10 pts)
  if (template.roleId && input.selectedRoleId === template.roleId) {
    score += 10;
    reasons.push({ code: 'role_match', messageKey: 'prediction.reason.roleMatch', weight: 10 });
  }

  // Feedback boost: recently accepted templates get +10
  const feedbackScore = computeFeedbackBoost(template.id, 'template', input.recentFeedback ?? []);
  if (feedbackScore > 0) {
    score += feedbackScore;
    reasons.push({ code: 'feedback_boost', messageKey: 'prediction.reason.feedbackBoost', weight: feedbackScore });
  } else if (feedbackScore < 0) {
    score += feedbackScore; // penalty
    reasons.push({ code: 'feedback_penalty', messageKey: 'prediction.reason.feedbackPenalty', weight: feedbackScore });
  }

  // Usage frequency from recent shifts (up to 10 pts)
  const usageCount = input.recentCompletedShifts.filter((s) => s.shiftTemplateId === template.id).length;
  const usageScore = Math.min(10, usageCount * 2);
  if (usageScore > 0) {
    score += usageScore;
    reasons.push({
      code: 'usage_frequency',
      messageKey: 'prediction.reason.usageFrequency',
      weight: usageScore,
      metadata: { usageCount },
    });
  }

  const totalScore = Math.min(100, Math.round(score));

  return {
    source: 'template',
    sourceId: template.id,
    suggestedScheduledStart: range.start,
    suggestedScheduledEnd: range.end,
    suggestedExpectedEnd: range.end,
    suggestedWorkplaceId: template.workplaceId,
    suggestedRoleId: template.roleId,
    suggestedTemplateId: template.id,
    suggestedSalaryProfileId: template.salaryProfileId,
    suggestedBreakMinutes: template.expectedBreakMinutes,
    suggestedBreakType: template.expectedBreakType,
    score: totalScore,
    confidence: scoreToConfidence(totalScore),
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Historical pattern scoring
// ---------------------------------------------------------------------------

function scoreHistoricalPattern(
  pattern: HistoricalPattern,
  now: Date,
  input: PredictionEngineInput,
): ShiftPredictionCandidate | null {
  if (pattern.weekday !== input.weekday) return null;
  if (pattern.observationCount < 3) return null; // Minimum observations

  const localDate = formatLocalDate(now, input.timezone);
  const range = resolveLocalShiftRange(localDate, pattern.medianStartTime, pattern.medianEndTime, input.timezone);
  const patternStart = parseISO(range.start);
  const diffMinutes = Math.abs(differenceInMinutes(now, patternStart));

  if (diffMinutes > TEMPLATE_START_MAX_DIFF_MINUTES) return null;

  const reasons: PredictionReason[] = [];
  let score = 0;

  // Start-time proximity (up to 40 pts)
  const proximityScore = diffMinutes <= PROXIMITY_FULL_MATCH_MINUTES
    ? 35
    : Math.max(0, Math.round(35 * (1 - (diffMinutes - PROXIMITY_FULL_MATCH_MINUTES) / (TEMPLATE_START_MAX_DIFF_MINUTES - PROXIMITY_FULL_MATCH_MINUTES))));
  score += proximityScore;
  reasons.push({
    code: 'historical_start_proximity',
    messageKey: 'prediction.reason.historicalStartProximity',
    weight: proximityScore,
    metadata: { diffMinutes, medianStart: pattern.medianStartTime },
  });

  // Weekday (already matched) - 15 pts
  score += 15;
  reasons.push({ code: 'weekday_match', messageKey: 'prediction.reason.weekdayMatch', weight: 15 });

  // Workplace match (15 pts)
  if (input.selectedWorkplaceId === pattern.workplaceId) {
    score += 15;
    reasons.push({ code: 'workplace_match', messageKey: 'prediction.reason.workplaceMatch', weight: 15 });
  }

  // Role match (10 pts)
  if (pattern.roleId && input.selectedRoleId === pattern.roleId) {
    score += 10;
    reasons.push({ code: 'role_match', messageKey: 'prediction.reason.roleMatch', weight: 10 });
  }

  // Observation count bonus (up to 10 pts)
  const obsScore = Math.min(10, Math.round(pattern.observationCount * 1.5));
  score += obsScore;
  reasons.push({
    code: 'observation_count',
    messageKey: 'prediction.reason.observationCount',
    weight: obsScore,
    metadata: { observationCount: pattern.observationCount },
  });

  // Historical patterns are weaker than templates — apply a small penalty
  score = Math.max(0, score - 5);

  const totalScore = Math.min(100, Math.round(score));

  return {
    source: 'historical_pattern',
    sourceId: pattern.patternId,
    suggestedScheduledStart: range.start,
    suggestedScheduledEnd: range.end,
    suggestedExpectedEnd: range.end,
    suggestedWorkplaceId: pattern.workplaceId,
    suggestedRoleId: pattern.roleId,
    suggestedBreakMinutes: Math.round(pattern.medianBreakMinutes),
    score: totalScore,
    confidence: scoreToConfidence(totalScore),
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Feedback helpers
// ---------------------------------------------------------------------------

/**
 * Compute a feedback-based score adjustment for a candidate.
 * Accepted templates get a small boost; rejected ones get a penalty.
 * Capped at ±10 to prevent feedback from dominating explicit schedule or proximity.
 */
function computeFeedbackBoost(
  sourceId: string,
  _source: string,
  feedback: readonly PredictionFeedback[],
): number {
  const relevant = feedback.filter((f) => f.candidateSourceId === sourceId);
  if (relevant.length === 0) return 0;

  let boost = 0;
  for (const f of relevant) {
    if (f.feedbackType === 'accepted_all') boost += 3;
    else if (f.feedbackType === 'accepted_partial') boost += 1;
    else if (f.feedbackType === 'rejected') boost -= 3;
    else if (f.feedbackType === 'edited_after_acceptance') boost += 0.5;
  }
  return Math.max(-10, Math.min(10, Math.round(boost)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLocalDate(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(date);
  } catch {
    return format(date, 'yyyy-MM-dd');
  }
}

// Re-export for convenience
export { scoreToConfidence };
export type { PredictionReason, ShiftPredictionCandidate, ShiftPredictionResult };
