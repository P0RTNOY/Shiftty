import { z } from 'zod';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const recurrenceFrequencySchema = z.enum(['weekly', 'biweekly']);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

export const recurrenceRuleSchema = z
  .object({
    id: z.string().min(1),
    frequency: recurrenceFrequencySchema,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    startsOn: z.iso.date(),
    endsOn: z.iso.date().optional(),
    occurrenceLimit: z.number().int().positive().max(520).optional(),
    timezone: z.string().min(1),
  })
  .superRefine((rule, context) => {
    if (new Set(rule.weekdays).size !== rule.weekdays.length) {
      context.addIssue({ code: 'custom', path: ['weekdays'], message: 'Weekdays must be unique.' });
    }
    if (rule.endsOn && rule.endsOn < rule.startsOn) {
      context.addIssue({ code: 'custom', path: ['endsOn'], message: 'End date must not precede start date.' });
    }
  });

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

export const recurringShiftTemplateSchema = z.object({
  workplaceId: z.string().min(1),
  roleId: z.string().min(1).optional(),
  shiftTemplateId: z.string().min(1).optional(),
  title: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4_000).optional(),
  startTime: localTimeSchema,
  endTime: localTimeSchema,
  expectedBreakMinutes: z.number().int().min(0),
  hourlyRateSnapshotMinor: z.number().int().min(0),
});

export type RecurringShiftTemplate = z.infer<typeof recurringShiftTemplateSchema>;

export const recurrenceSeriesSchema = z.object({
  id: z.string().min(1),
  rule: recurrenceRuleSchema,
  template: recurringShiftTemplateSchema,
  disabledFrom: z.iso.date().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type RecurrenceSeries = z.infer<typeof recurrenceSeriesSchema>;

export const recurrenceExceptionSchema = z.object({
  id: z.string().min(1),
  seriesId: z.string().min(1),
  localDate: z.iso.date(),
  type: z.enum(['deleted', 'modified']),
  shiftId: z.string().min(1).optional(),
  createdAt: z.iso.datetime({ offset: true }),
});

export type RecurrenceException = z.infer<typeof recurrenceExceptionSchema>;
export type RecurrenceScope = 'only' | 'future' | 'entire';
