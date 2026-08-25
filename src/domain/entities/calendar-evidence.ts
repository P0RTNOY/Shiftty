import { z } from 'zod';

const boundedIdSchema = z.string().trim().min(1).max(160);
const boundedNameSchema = z.string().trim().min(1).max(120);
const boundedSourceTitleSchema = z.string().trim().min(1).max(240);
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

const timeZoneSchema = z.string().trim().min(1).max(120).refine(isValidTimeZone, {
  message: 'A valid IANA timezone is required.',
});

const safeSourceUrlSchema = z.string().trim().max(2_048).url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, { message: 'Source URL must use HTTP or HTTPS.' });

export const specialIntervalTypeSchema = z.enum(['holiday', 'weekly_rest', 'custom']);
export type SpecialIntervalType = z.infer<typeof specialIntervalTypeSchema>;

export const evidenceSourceKindSchema = z.enum(['manual', 'confirmed_preset', 'imported']);
export type EvidenceSourceKind = z.infer<typeof evidenceSourceKindSchema>;

const evidenceSourceFields = {
  sourceKind: evidenceSourceKindSchema.default('manual'),
  sourceTitle: boundedSourceTitleSchema.optional(),
  sourceUrl: safeSourceUrlSchema.optional(),
  presetId: boundedIdSchema.optional(),
  presetVersion: z.string().trim().min(1).max(80).optional(),
};

export const calendarEvidenceIntervalSchema = z.object({
  id: boundedIdSchema,
  scheduleId: boundedIdSchema.optional(),
  workplaceId: boundedIdSchema,
  salaryProfileId: boundedIdSchema.optional(),
  type: specialIntervalTypeSchema,
  name: boundedNameSchema,
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  timezone: timeZoneSchema,
  ...evidenceSourceFields,
  confirmedAt: z.iso.datetime({ offset: true }),
  isArchived: z.boolean().default(false),
  archivedAt: z.iso.datetime({ offset: true }).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).superRefine((interval, context) => {
  if (Date.parse(interval.end) <= Date.parse(interval.start)) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'Evidence interval end must be after its start.' });
  }
  if (interval.sourceKind === 'confirmed_preset' && (!interval.presetId || !interval.presetVersion)) {
    context.addIssue({ code: 'custom', path: ['presetId'], message: 'Confirmed presets require an ID and version.' });
  }
  if (interval.isArchived !== Boolean(interval.archivedAt)) {
    context.addIssue({ code: 'custom', path: ['archivedAt'], message: 'Archived evidence requires an archive timestamp.' });
  }
});
export type CalendarEvidenceInterval = z.infer<typeof calendarEvidenceIntervalSchema>;

export const weeklyRestScheduleSchema = z.object({
  id: boundedIdSchema,
  workplaceId: boundedIdSchema,
  salaryProfileId: boundedIdSchema,
  label: boundedNameSchema,
  startWeekday: z.number().int().min(0).max(6),
  startTime: localTimeSchema,
  endWeekday: z.number().int().min(0).max(6),
  endTime: localTimeSchema,
  enabled: z.boolean().default(false),
  confirmedAt: z.iso.datetime({ offset: true }).optional(),
  ...evidenceSourceFields,
  isArchived: z.boolean().default(false),
  archivedAt: z.iso.datetime({ offset: true }).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).superRefine((schedule, context) => {
  if (schedule.startWeekday === schedule.endWeekday && schedule.startTime === schedule.endTime) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'Weekly-rest boundaries must differ.' });
  }
  if (schedule.enabled && !schedule.confirmedAt) {
    context.addIssue({ code: 'custom', path: ['confirmedAt'], message: 'An enabled weekly-rest schedule must be user-confirmed.' });
  }
  if (schedule.sourceKind === 'confirmed_preset' && (!schedule.presetId || !schedule.presetVersion)) {
    context.addIssue({ code: 'custom', path: ['presetId'], message: 'Confirmed presets require an ID and version.' });
  }
  if (schedule.isArchived !== Boolean(schedule.archivedAt)) {
    context.addIssue({ code: 'custom', path: ['archivedAt'], message: 'Archived schedules require an archive timestamp.' });
  }
});
export type WeeklyRestSchedule = z.infer<typeof weeklyRestScheduleSchema>;

/**
 * Immutable, bounded evidence copied into a salary result. Source content is
 * intentionally limited to a title and URL so snapshots remain explainable
 * without retaining arbitrary imported text.
 */
export const specialIntervalEvaluationSchema = z.object({
  intervalId: boundedIdSchema,
  scheduleId: boundedIdSchema.optional(),
  type: specialIntervalTypeSchema,
  name: boundedNameSchema,
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  timezone: timeZoneSchema,
  sourceKind: evidenceSourceKindSchema,
  sourceTitle: boundedSourceTitleSchema.optional(),
  sourceUrl: safeSourceUrlSchema.optional(),
  presetId: boundedIdSchema.optional(),
  presetVersion: z.string().trim().min(1).max(80).optional(),
  confirmedAt: z.iso.datetime({ offset: true }),
  appliedRuleIds: z.array(boundedIdSchema),
  contributedToEstimate: z.boolean(),
}).superRefine((evaluation, context) => {
  if (Date.parse(evaluation.end) <= Date.parse(evaluation.start)) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'Frozen evidence end must be after its start.' });
  }
});
export type SpecialIntervalEvaluation = z.infer<typeof specialIntervalEvaluationSchema>;
