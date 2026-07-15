import { z } from 'zod';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const shiftTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  defaultStartTime: localTimeSchema,
  defaultEndTime: localTimeSchema,
  expectedBreakMinutes: z.number().int().min(0),
  workplaceId: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  salaryProfileId: z.string().min(1).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type ShiftTemplate = z.infer<typeof shiftTemplateSchema>;
