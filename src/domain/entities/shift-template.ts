import { z } from 'zod';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const shiftTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  defaultStartTime: localTimeSchema,
  defaultEndTime: localTimeSchema,
  /** Whole-shift premium. 10,000 basis points = 100%. */
  payMultiplierBasisPoints: z.number().int().min(10_000).max(100_000).optional(),
  expectedBreakMinutes: z.number().int().min(0),
  expectedBreakType: z.enum(['paid', 'unpaid']).optional(),
  /** ISO weekday numbers 0=Sun…6=Sat. Absent means all weekdays valid. */
  validWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  expectedDurationMinutes: z.number().int().positive().optional(),
  colorToken: z.string().max(30).optional(),
  workplaceId: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  salaryProfileId: z.string().min(1).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type ShiftTemplate = z.infer<typeof shiftTemplateSchema>;
