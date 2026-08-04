import { runPredictionEngine, PREDICTION_ENGINE_VERSION } from '@/domain/services/shift-prediction-engine';
import type { PredictionEngineInput } from '@/domain/services/shift-prediction-engine';
import type { Shift, ShiftTemplate } from '@/domain/entities';

const NOW = '2026-08-04T08:00:00+03:00'; // Monday (weekday=1), 08:00 local
const TIMEZONE = 'Asia/Jerusalem';

const BASE_SHIFT: Shift = {
  id: 'shift-1',
  status: 'scheduled',
  workplaceId: 'wp-1',
  scheduledStart: '2026-08-04T08:00:00+03:00',
  scheduledEnd: '2026-08-04T16:00:00+03:00',
  expectedBreakMinutes: 30,
  hourlyRateSnapshotMinor: 3000,
  salaryCalculationStatus: 'not_calculated',
  timezone: TIMEZONE,
  createdAt: '2026-01-01T00:00:00+03:00',
  updatedAt: '2026-01-01T00:00:00+03:00',
};

const BASE_TEMPLATE: ShiftTemplate = {
  id: 'tmpl-morning',
  name: 'משמרת בוקר',
  defaultStartTime: '08:00',
  defaultEndTime: '16:00',
  expectedBreakMinutes: 30,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00+03:00',
  updatedAt: '2026-01-01T00:00:00+03:00',
};

function makeInput(overrides: Partial<PredictionEngineInput> = {}): PredictionEngineInput {
  return {
    now: NOW,
    timezone: TIMEZONE,
    weekday: 1, // Monday
    nearbyScheduledShifts: [],
    templates: [],
    recentCompletedShifts: [],
    historicalPatterns: [],
    recentFeedback: [],
    ...overrides,
  };
}

describe('runPredictionEngine', () => {
  it('returns no recommendation when no candidates', () => {
    const result = runPredictionEngine(makeInput());
    expect(result.recommended).toBeUndefined();
    expect(result.candidates).toHaveLength(0);
    expect(result.engineVersion).toBe(PREDICTION_ENGINE_VERSION);
  });

  it('surfaces a nearby scheduled shift with a high score', () => {
    const result = runPredictionEngine(makeInput({ nearbyScheduledShifts: [BASE_SHIFT] }));
    expect(result.recommended?.source).toBe('nearby_scheduled_shift');
    expect(result.recommended?.sourceId).toBe(BASE_SHIFT.id);
    expect(result.recommended!.score).toBeGreaterThanOrEqual(40);
  });

  it('surfaces a template when start time matches within 120 minutes', () => {
    const result = runPredictionEngine(makeInput({ templates: [BASE_TEMPLATE] }));
    expect(result.recommended?.source).toBe('template');
    expect(result.recommended?.sourceId).toBe(BASE_TEMPLATE.id);
  });

  it('prefers nearby scheduled shift over template with same time', () => {
    const result = runPredictionEngine(makeInput({
      nearbyScheduledShifts: [BASE_SHIFT],
      templates: [BASE_TEMPLATE],
    }));
    expect(result.recommended?.source).toBe('nearby_scheduled_shift');
  });

  it('respects valid weekdays restriction — excludes template on wrong weekday', () => {
    const fridayOnlyTemplate: ShiftTemplate = {
      ...BASE_TEMPLATE,
      id: 'tmpl-fri',
      validWeekdays: [5], // Friday only
    };
    const result = runPredictionEngine(makeInput({ templates: [fridayOnlyTemplate], weekday: 1 }));
    expect(result.candidates.find((c) => c.sourceId === 'tmpl-fri')).toBeUndefined();
  });

  it('accepts template on valid weekday', () => {
    const mondayTemplate: ShiftTemplate = {
      ...BASE_TEMPLATE,
      id: 'tmpl-mon',
      validWeekdays: [1], // Monday
    };
    const result = runPredictionEngine(makeInput({ templates: [mondayTemplate], weekday: 1 }));
    expect(result.candidates.find((c) => c.sourceId === 'tmpl-mon')).toBeDefined();
  });

  it('scores correctly adds workplace and role match bonuses', () => {
    const result = runPredictionEngine(makeInput({
      nearbyScheduledShifts: [BASE_SHIFT],
      selectedWorkplaceId: 'wp-1',
      selectedRoleId: 'role-1',
    }));
    expect(result.recommended?.score).toBeGreaterThanOrEqual(65);
  });

  it('excludes past scheduled shifts', () => {
    const pastShift: Shift = {
      ...BASE_SHIFT,
      scheduledStart: '2026-08-01T08:00:00+03:00',
      scheduledEnd: '2026-08-01T16:00:00+03:00',
    };
    const result = runPredictionEngine(makeInput({ nearbyScheduledShifts: [pastShift] }));
    expect(result.candidates.find((c) => c.sourceId === pastShift.id)).toBeUndefined();
  });

  it('excludes archived templates', () => {
    const archived: ShiftTemplate = { ...BASE_TEMPLATE, id: 'tmpl-archived', isArchived: true };
    const result = runPredictionEngine(makeInput({ templates: [archived] }));
    expect(result.candidates.find((c) => c.sourceId === 'tmpl-archived')).toBeUndefined();
  });

  it('returns a deterministic order for equal-score candidates', () => {
    const result1 = runPredictionEngine(makeInput({ templates: [BASE_TEMPLATE] }));
    const result2 = runPredictionEngine(makeInput({ templates: [BASE_TEMPLATE] }));
    expect(result1.candidates.map((c) => c.sourceId)).toEqual(result2.candidates.map((c) => c.sourceId));
  });

  it('generatedAt matches now input', () => {
    const result = runPredictionEngine(makeInput());
    expect(result.generatedAt).toBe(NOW);
  });
});
